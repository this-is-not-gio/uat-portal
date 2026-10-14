import { createClient } from "@/lib/supabase/server";

// A comment anchors to a quote inside one report page (section, 0-based); prefix/suffix are the
// text around it, so the same words elsewhere on the page can be told apart (see lib/report/comment-anchor).
export type signOffComment = {
    id: string;
    page: number;
    quote: string;
    prefix: string;
    suffix: string;
    body: string;
    // Set on a reply: the top-level comment it answers.
    parentId: string | null;
    authorId: string;
    authorName: string;
    // The author's organization type (external / client / vendor); picks the avatar color. Null when it can't be read.
    authorOrgType: string | null;
    createdAt: string;
};

export async function getSignOffComments(signOffId: string): Promise<signOffComment[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("sign_off_comments")
        .select("id, page, quote, prefix, suffix, body, parent_id, created_by, created_at, author:profiles(full_name, organization:organizations(type))")
        .eq("sign_off_id", signOffId)
        .order("created_at");
    if (error) throw error;
    return data.map((c) => ({
        id: c.id, page: c.page, quote: c.quote, prefix: c.prefix, suffix: c.suffix, body: c.body, parentId: c.parent_id,
        authorId: c.created_by, authorName: c.author?.full_name || "Unknown", authorOrgType: c.author?.organization?.type ?? null, createdAt: c.created_at,
    }));
}
