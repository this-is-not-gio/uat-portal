import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { blockData, blockType } from "@/lib/manual/blocks";

export type manualSection = { id: string; title: string; slug: string; description: string };

export type manualModule = {
    id: string;
    title: string;
    description: string;
    slug: string;
    isPublished: boolean;
    sections: manualSection[];
};

type ModuleRow = {
    id: string;
    title: string;
    description: string;
    slug: string;
    is_published: boolean;
    sections: { id: string; title: string; slug: string; description: string; sort_order: number }[] | null;
};

// RLS decides what's visible: Admin gets every module, everyone else only published ones.
// One query for the whole nav tree; shared by the layout and pages within a request.
export const getManualTree = cache(async (): Promise<manualModule[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("manual_modules")
        .select("id, title, slug, description, is_published, sections:manual_sections(id, title, slug, description, sort_order)")
        .order("sort_order")
        .order("created_at");
    if (error) throw error;
    return (data as ModuleRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        slug: row.slug,
        isPublished: row.is_published,
        sections: (row.sections ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(({ id, title, slug, description }) => ({ id, title, slug, description })),
    }));
});

export async function getManualModuleBySlug(slug: string): Promise<manualModule | null> {
    return (await getManualTree()).find((m) => m.slug === slug) ?? null;
}

export type manualBlock = { id: string; blockType: blockType; header: string; body: string; data: blockData };

// A block container is a module's own content (sectionId null) or one of its sections.
export type manualBlockContainer = { moduleId: string; sectionId: string | null };

export async function getManualBlocks({ moduleId, sectionId }: manualBlockContainer): Promise<manualBlock[]> {
    const supabase = await createClient();
    let query = supabase.from("manual_blocks").select("id, block_type, header, body, data").eq("module_id", moduleId);
    query = sectionId ? query.eq("section_id", sectionId) : query.is("section_id", null);
    const { data, error } = await query.order("sort_order").order("created_at");
    if (error) throw error;
    return data.map((row) => ({
        id: row.id,
        blockType: row.block_type as blockType,
        header: row.header,
        body: row.body,
        data: (row.data ?? {}) as blockData,
    }));
}

export type linkableModule = { id: string; title: string; description: string; sectionCount: number; isPublished: boolean };
export type suiteManualLinks = { modules: linkableModule[]; linkedIds: string[] };

// Link Manual dialog data (Admin): published modules plus any linked one since unpublished.
export async function getSuiteManualLinks(suiteId: string): Promise<suiteManualLinks> {
    const [tree, linkedIds] = await Promise.all([getManualTree(), getSuiteManualModuleIds(suiteId)]);
    return {
        linkedIds,
        modules: tree
            .filter((m) => m.isPublished || linkedIds.includes(m.id))
            .map((m) => ({ id: m.id, title: m.title, description: m.description, sectionCount: m.sections.length, isPublished: m.isPublished })),
    };
}

// Module ids linked to a suite, in link order (the order the Manual tab shows them).
// cache()'d: the suite layout, manual layout and page all ask within one request.
export const getSuiteManualModuleIds = cache(async (suiteId: string): Promise<string[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("suite_manual_modules")
        .select("module_id")
        .eq("suite_id", suiteId)
        .order("created_at")
        .order("module_id");
    if (error) throw error;
    return data.map((row) => row.module_id);
});

// A suite's linked modules in link order, as tree entries. Visibility rides on the manual RLS
// (non-Admins only get published modules), so a linked-but-unpublished module drops out for them.
export const getSuiteManualModules = cache(async (suiteId: string): Promise<manualModule[]> => {
    const [tree, linkedIds] = await Promise.all([getManualTree(), getSuiteManualModuleIds(suiteId)]);
    const byId = new Map(tree.map((m) => [m.id, m]));
    return linkedIds.flatMap((id) => byId.get(id) ?? []);
});

// Null when the module isn't linked to the suite or the viewer can't see it.
export async function getSuiteManualModuleBySlug(suiteId: string, slug: string): Promise<manualModule | null> {
    return (await getSuiteManualModules(suiteId)).find((m) => m.slug === slug) ?? null;
}
