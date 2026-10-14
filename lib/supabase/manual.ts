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
