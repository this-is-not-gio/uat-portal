"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import { RESERVED_MODULE_SLUGS, uniqueSlug } from "@/lib/manual/slug";
import type { actionResult } from "./iteration-actions";
import { defaultBlockHeader, hasBlockHeader, type blockData, type blockType } from "@/lib/manual/blocks";

// Manual CMS writes. Admin only: checked here for a clear message, and again by RLS.

export async function createManualModule(input: { title: string }): Promise<actionResult<{ slug: string }>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const title = input.title.trim();
    if (!title) return { ok: false, error: "A module needs a title." };

    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase.from("manual_modules").select("slug, sort_order");
    if (readError) return { ok: false, error: readError.message };

    const slug = uniqueSlug(title, existing.map((m) => m.slug), RESERVED_MODULE_SLUGS);
    const sortOrder = existing.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1;

    const { error } = await supabase.from("manual_modules").insert({ title, slug, sort_order: sortOrder });
    if (error) return { ok: false, error: error.message };

    refresh();
    return { ok: true, data: { slug } };
}

export async function createManualSection(input: { moduleId: string; title: string }): Promise<actionResult<{ moduleSlug: string; slug: string }>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const title = input.title.trim();
    if (!title) return { ok: false, error: "A section needs a title." };

    const supabase = await createClient();
    const { data: parent, error: parentError } = await supabase.from("manual_modules").select("slug").eq("id", input.moduleId).maybeSingle();
    if (parentError) return { ok: false, error: parentError.message };
    if (!parent) return { ok: false, error: "Module not found." };

    const { data: existing, error: readError } = await supabase.from("manual_sections").select("slug, sort_order").eq("module_id", input.moduleId);
    if (readError) return { ok: false, error: readError.message };

    const slug = uniqueSlug(title, existing.map((s) => s.slug), [], "section");
    const sortOrder = existing.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

    const { error } = await supabase.from("manual_sections").insert({ module_id: input.moduleId, title, slug, sort_order: sortOrder });
    if (error) return { ok: false, error: error.message };

    refresh();
    return { ok: true, data: { moduleSlug: parent.slug, slug } };
}

export async function setManualModulePublished(input: { id: string; isPublished: boolean }): Promise<actionResult<null>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("manual_modules")
        .update({ is_published: input.isPublished, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Module not found." };

    refresh();
    return { ok: true, data: null };
}

export async function createManualBlock(input: {
    moduleId: string;
    sectionId: string | null;
    blockType: blockType;
    header: string;
    body: string;
    data: blockData;
}): Promise<actionResult<{ id: string }>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const header = hasBlockHeader(input.blockType) ? input.header.trim() : defaultBlockHeader(input.blockType);
    if (!header) return { ok: false, error: "A block needs a header." };

    const supabase = await createClient();
    let siblings = supabase.from("manual_blocks").select("sort_order").eq("module_id", input.moduleId);
    siblings = input.sectionId ? siblings.eq("section_id", input.sectionId) : siblings.is("section_id", null);
    const { data: existing, error: readError } = await siblings;
    if (readError) return { ok: false, error: readError.message };
    const sortOrder = existing.reduce((max, b) => Math.max(max, b.sort_order), -1) + 1;

    const { data: created, error } = await supabase.from("manual_blocks").insert({
        module_id: input.moduleId,
        section_id: input.sectionId,
        block_type: input.blockType,
        header,
        body: input.body,
        data: input.data,
        sort_order: sortOrder,
    }).select("id").single();
    if (error) return { ok: false, error: error.message };

    refresh();
    return { ok: true, data: { id: created.id } };
}

export async function updateManualBlock(input: { id: string; header: string; body: string; data: blockData }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const header = input.header.trim();
    if (!header) return { ok: false, error: "A block needs a header." };

    const supabase = await createClient();
    const { error } = await supabase
        .from("manual_blocks")
        .update({ header, body: input.body, data: input.data, updated_at: new Date().toISOString() })
        .eq("id", input.id);
    if (error) return { ok: false, error: error.message };

    refresh();
    return { ok: true, data: undefined };
}

export async function deleteManualBlock(input: { id: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const supabase = await createClient();
    const { error } = await supabase.from("manual_blocks").delete().eq("id", input.id);
    if (error) return { ok: false, error: error.message };

    refresh();
    return { ok: true, data: undefined };
}

// Saves the title and description; the slug is fixed so existing links keep working.
export async function renameManualModule(input: { id: string; title: string; description: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const title = input.title.trim();
    if (!title) return { ok: false, error: "A module needs a title." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("manual_modules")
        .update({ title, description: input.description.trim(), updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Module not found." };

    refresh();
    return { ok: true, data: undefined };
}

export async function renameManualSection(input: { id: string; title: string; description: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const title = input.title.trim();
    if (!title) return { ok: false, error: "A section needs a title." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("manual_sections")
        .update({ title, description: input.description.trim(), updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Section not found." };

    refresh();
    return { ok: true, data: undefined };
}

// Sections and blocks go with the module via ON DELETE CASCADE. The current page is gone
// afterwards, so redirect here instead of refreshing it into a 404.
export async function deleteManualModule(input: { id: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const supabase = await createClient();
    const { data, error } = await supabase.from("manual_modules").delete().eq("id", input.id).select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Module not found." };

    revalidatePath("/manual", "layout");
    redirect("/manual");
}

export async function deleteManualSection(input: { id: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const supabase = await createClient();
    const { data: section, error: readError } = await supabase
        .from("manual_sections")
        .select("module:manual_modules(slug)")
        .eq("id", input.id)
        .maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    if (!section) return { ok: false, error: "Section not found." };
    const moduleSlug = (section.module as unknown as { slug: string } | null)?.slug;

    const { error } = await supabase.from("manual_sections").delete().eq("id", input.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/manual", "layout");
    redirect(moduleSlug ? `/manual/${moduleSlug}` : "/manual");
}
