import { createClient } from "@/lib/supabase/server";
import type { Database } from "./database.types";

export type orgType = Database["public"]["Enums"]["org_type"];

export type organization = { id: string; name: string; type: orgType };

// A role in the global test role catalog (0056), e.g. "Action Officer - Licensing".
export type testRole = { id: string; name: string };

// An org's instance of a catalog role; its name is the catalog name.
export type orgRole = { id: string; name: string; organizationId: string; testRoleId: string };

// A catalog role with the orgs that have it, for the admin Roles page.
export type catalogRole = testRole & { instances: orgRole[] };

// The enum predates the Internal/External naming: "client" orgs are the Internal ones.
export { ORG_TYPE_LABELS } from "@/lib/org-type-labels";

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

// Roles of every org the current user can see, A–Z (same RLS as organizations).
export async function getOrganizationRoles(): Promise<orgRole[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("organization_roles").select("id, organization_id, test_role:test_roles ( id, name )");
    if (error) throw error;
    return data
        .map((r) => ({ id: r.id, name: r.test_role.name, organizationId: r.organization_id, testRoleId: r.test_role.id }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// The whole catalog A–Z, each role with the org instances the current user can see.
export async function getCatalogRoles(): Promise<catalogRole[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("test_roles").select("id, name, organization_roles ( id, organization_id )").order("name");
    if (error) throw error;
    return data.map((t) => ({
        id: t.id,
        name: t.name,
        instances: t.organization_roles.map((r) => ({ id: r.id, name: t.name, organizationId: r.organization_id, testRoleId: t.id })),
    }));
}

// Catalog roles to pick from (test case role, Overview Test Accounts), grouped by the kind of
// org that has them: a catalog role given to both an Internal and an External org shows in both lists.
export type testRoleOptions = { internal: testRole[]; external: testRole[] };

export async function getTestRoleOptions(): Promise<testRoleOptions> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("test_roles").select("id, name, organization_roles ( organizations!inner ( type ) )").order("name");
    if (error) throw error;
    const options: testRoleOptions = { internal: [], external: [] };
    for (const role of data) {
        const types = new Set(role.organization_roles.map((r) => r.organizations.type));
        if (types.has("client")) options.internal.push({ id: role.id, name: role.name });
        if (types.has("external")) options.external.push({ id: role.id, name: role.name });
    }
    return options;
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

// Tester accounts per org role id (organization_roles.id), for the Roles tab. Same RLS as above.
export async function getTesterCountsByRole(): Promise<Record<string, number>> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("org_role_id").not("org_role_id", "is", null);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const profile of data) {
        if (profile.org_role_id) counts[profile.org_role_id] = (counts[profile.org_role_id] ?? 0) + 1;
    }
    return counts;
}
