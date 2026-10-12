"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { actionResult } from "./iteration-actions";

// Manual CMS drag-to-reorder. Admin only; the RPCs also check is_admin() and that the ids
// are exactly one parent's rows.

export async function reorderManualModules(input: { moduleIds: string[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_manual_modules", { p_module_ids: input.moduleIds });
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, data: undefined };
}

export async function reorderManualSections(input: { moduleId: string; sectionIds: string[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_manual_sections", { p_module_id: input.moduleId, p_section_ids: input.sectionIds });
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, data: undefined };
}

// sectionId null = the module's own blocks.
export async function reorderManualBlocks(input: { moduleId: string; sectionId: string | null; blockIds: string[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_manual_blocks", {
        p_module_id: input.moduleId,
        // The generated type for a nullable uuid arg is `string`; null means "module-level".
        p_section_id: input.sectionId as string,
        p_block_ids: input.blockIds,
    });
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, data: undefined };
}
