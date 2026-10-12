"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import { RESERVED_MODULE_SLUGS, uniqueSlug } from "@/lib/manual/slug";
import type { actionResult } from "./iteration-actions";

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
