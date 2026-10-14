"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { signOffComment } from "./sign-off-comments";

type result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// The client comments on text of the issued report (0070). Postgres checks the report is still awaiting a decision.
export async function addSignOffComment(input: { signOffId: string; page: number; quote: string; prefix: string; suffix: string; body: string }): Promise<result<signOffComment>> {
    const user = await requireUser();
    if (!can(user, "sign_off")) return denied("sign_off");
    const body = input.body.trim();
    if (!body) return { ok: false, error: "Write a comment first." };
    if (body.length > 2000) return { ok: false, error: "Comments can be up to 2000 characters." };
    if (!input.quote.trim()) return { ok: false, error: "Select some text to comment on." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_sign_off_comment", {
        p_sign_off_id: input.signOffId,
        p_page: input.page,
        p_quote: input.quote.slice(0, 500),
        p_prefix: input.prefix.slice(-64),
        p_suffix: input.suffix.slice(0, 64),
        p_body: body,
    });
    if (error) {
        console.error("Add sign-off comment failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return {
        ok: true,
        data: { id: data.id, page: data.page, quote: data.quote, prefix: data.prefix, suffix: data.suffix, body: data.body, parentId: data.parent_id, authorId: user.id, authorName: user.fullName, authorOrgType: user.organization?.type ?? null, createdAt: data.created_at },
    };
}

export async function replySignOffComment({ parentId, body: rawBody }: { parentId: string; body: string }): Promise<result> {
    const user = await requireUser();
    if (!can(user, "sign_off")) return denied("sign_off");
    const body = rawBody.trim();
    if (!body) return { ok: false, error: "Write a reply first." };
    if (body.length > 2000) return { ok: false, error: "Replies can be up to 2000 characters." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("reply_sign_off_comment", { p_parent_id: parentId, p_body: body });
    if (error) {
        console.error("Reply to sign-off comment failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: undefined };
}

export async function updateSignOffComment({ commentId, body: rawBody }: { commentId: string; body: string }): Promise<result> {
    const user = await requireUser();
    if (!can(user, "sign_off")) return denied("sign_off");
    const body = rawBody.trim();
    if (!body) return { ok: false, error: "Write a comment first." };
    if (body.length > 2000) return { ok: false, error: "Comments can be up to 2000 characters." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_sign_off_comment", { p_comment_id: commentId, p_body: body });
    if (error) {
        console.error("Update sign-off comment failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: undefined };
}

export async function deleteSignOffComment({ commentId }: { commentId: string }): Promise<result> {
    const user = await requireUser();
    if (!can(user, "sign_off")) return denied("sign_off");
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_sign_off_comment", { p_comment_id: commentId });
    if (error) {
        console.error("Delete sign-off comment failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: undefined };
}
