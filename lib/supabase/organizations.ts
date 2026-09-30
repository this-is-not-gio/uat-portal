import { createClient } from "@/lib/supabase/server";
import type { Database } from "./database.types";

export type orgType = Database["public"]["Enums"]["org_type"];

export type organization = { id: string; name: string; type: orgType };

const TYPE_ORDER: Record<orgType, number> = { vendor: 0, client: 1, external: 2 };

// Vendor first, then the client, then the external companies A–Z.
export function compareOrganizations(a: organization, b: organization): number {
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name);
}

// Every org the current user can see (RLS: Admin/Internal see all, others only their own).
export async function getOrganizations(): Promise<organization[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("organizations").select("id, name, type");
    if (error) throw error;
    return data.sort(compareOrganizations);
}

// Tester accounts (Internal/External) per org id, for the participant pickers.
// RLS: Admin/Internal see every profile; others only get their own org's count.
export async function getTesterCountsByOrg(): Promise<Record<string, number>> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("organization_id").in("role", ["Internal", "External"]);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const profile of data) {
        if (profile.organization_id) counts[profile.organization_id] = (counts[profile.organization_id] ?? 0) + 1;
    }
    return counts;
}
