"use server"

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import * as storage from "@/lib/storage/b2";

// Draft side of evidence attachments (#17): create -> browser PUT to the bucket -> confirm ->
// (later tickets) link on Post. Rules live in Postgres (0062); failures come back as values.
export type actionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Attachment action failed:", error.message);
    return { ok: false, error: error.message };
}

export type attachmentView = {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    kind: "image" | "pdf" | "video";
    status: "pending" | "ready";
};

type attachmentRow = { id: string; file_name: string; content_type: string; size_bytes: number; kind: attachmentView["kind"]; status: attachmentView["status"] };

function toView(r: attachmentRow): attachmentView {
    return { id: r.id, fileName: r.file_name, contentType: r.content_type, sizeBytes: r.size_bytes, kind: r.kind, status: r.status };
}

export type uploadTicket = { attachment: attachmentView; uploadUrl: string };

export async function createAttachmentUpload({ stepResultId, fileName, contentType, sizeBytes }: {
    stepResultId: string; fileName: string; contentType: string; sizeBytes: number;
}): Promise<actionResult<uploadTicket>> {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_draft_attachment", {
        p_step_result_id: stepResultId, p_file_name: fileName, p_content_type: contentType, p_size_bytes: sizeBytes,
    });
    if (error) return fail(error);
    try {
        const uploadUrl = await storage.presignPut({ key: data.object_key, contentType: data.content_type, contentLength: data.size_bytes });
        return { ok: true, data: { attachment: toView(data), uploadUrl } };
    } catch (e) {
        // Do not leave a draft that can never be uploaded.
        await supabase.rpc("delete_draft_attachment", { p_attachment_id: data.id });
        return fail(e as Error);
    }
}

// One HEAD check that what landed in the bucket is what the draft promised.
export async function confirmAttachmentUpload({ attachmentId }: { attachmentId: string }): Promise<actionResult<attachmentView>> {
    await requireUser();
    const supabase = await createClient();
    // Own drafts only: the read rule hides anyone else's.
    const { data: row, error } = await supabase
        .from("attachments")
        .select("id, object_key, file_name, content_type, size_bytes, kind, status, remark_id")
        .eq("id", attachmentId)
        .maybeSingle();
    if (error) return fail(error);
    if (!row || row.remark_id) return { ok: false, error: "Attachment not found." };

    let found: Awaited<ReturnType<typeof storage.head>>;
    try {
        found = await storage.head(row.object_key);
    } catch (e) {
        return fail(e as Error);
    }
    if (!found) return { ok: false, error: "The file never finished uploading." };
    if (found.size !== row.size_bytes || found.contentType !== row.content_type) {
        return { ok: false, error: "The uploaded file does not match what was declared." };
    }

    const { data, error: markError } = await supabase.rpc("mark_attachment_ready", { p_attachment_id: attachmentId });
    if (markError) return fail(markError);
    return { ok: true, data: toView(data) };
}

export async function deleteDraftAttachment({ attachmentId }: { attachmentId: string }): Promise<actionResult> {
    await requireUser();
    const supabase = await createClient();
    const { data: key, error } = await supabase.rpc("delete_draft_attachment", { p_attachment_id: attachmentId });
    if (error) return fail(error);
    try {
        await storage.remove(key);
    } catch (e) {
        // The row is gone; an orphaned object is acceptable here (cleanup comes with the deletion queue).
        console.error("Attachment object removal failed:", (e as Error).message);
    }
    return { ok: true, data: undefined };
}

export type signedAttachment = attachmentView & { url: string };

// Selected with the viewer's own client so the read rules decide what comes back, then signed in one batch.
export async function listSignedAttachments({ stepResultId }: { stepResultId: string }): Promise<actionResult<signedAttachment[]>> {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("attachments")
        .select("id, object_key, file_name, content_type, size_bytes, kind, status")
        .eq("test_step_result_id", stepResultId)
        .eq("status", "ready")
        .order("created_at");
    if (error) return fail(error);
    try {
        const signed = await Promise.all(data.map(async (r) => ({
            ...toView(r),
            url: await storage.presignGet({ key: r.object_key, contentType: r.content_type, fileName: r.file_name }),
        })));
        return { ok: true, data: signed };
    } catch (e) {
        return fail(e as Error);
    }
}
