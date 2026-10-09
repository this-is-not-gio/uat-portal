"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "./admin";
import { requireUser, type currentUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { actionResult } from "./iteration-actions";
import type { organization, orgRole, orgType } from "./organizations";

// Users and organizations for the /admin area. Every action re-checks admin_area itself:
// the /admin layout only hides the pages, it doesn't protect a direct action call.

type role = currentUser["role"];

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Admin action failed:", error.message);
    return { ok: false, error: error.message };
}

// Each role belongs to one kind of org, so a user can't end up as e.g. an Admin of Company A.
const ROLE_ORG_TYPE: Record<role, orgType> = {
    Admin: "vendor",
    Internal: "client",
    External: "external",
};

async function checkRoleMatchesOrg(
    role: role,
    organizationId: string,
): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("organizations")
        .select("type")
        .eq("id", organizationId)
        .single();
    if (error) return "That organization doesn't exist.";
    if (data.type !== ROLE_ORG_TYPE[role])
        return `${role} users must belong to a ${ROLE_ORG_TYPE[role]} organization.`;
    return null;
}

// The FK (0051) already rejects a role from another org; this just gives a readable message.
async function checkRoleInOrg(orgRoleId: string | null, organizationId: string): Promise<string | null> {
    if (!orgRoleId) return null;
    const supabase = await createClient();
    const { data } = await supabase
        .from("organization_roles")
        .select("organization_id")
        .eq("id", orgRoleId)
        .maybeSingle();
    return data?.organization_id === organizationId ? null : "That test role doesn't belong to the selected organization.";
}

// Users -----------------------------------------------------------------------

export type adminUser = {
    id: string;
    email: string | null;
    fullName: string;
    role: role;
    organization: organization | null;
    orgRole: { id: string; name: string } | null;
    invitedAt: string | null;
    lastSignInAt: string | null;
};

export async function listUsers(): Promise<actionResult<adminUser[]>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const admin = createAdminClient();

    const [
        { data: authData, error: authError },
        { data: profiles, error: profileError },
    ] = await Promise.all([
        admin.auth.admin.listUsers({ perPage: 1000 }),
        admin
            .from("profiles")
            .select(
                "id, full_name, role, organization:organizations(id, name, type), org_role:organization_roles(id, name)",
            ),
    ]);
    if (authError) return fail(authError);
    if (profileError) return fail(profileError);

    const authById = new Map(authData.users.map((u) => [u.id, u]));
    return {
        ok: true,
        data: profiles
            .map((p) => {
                const account = authById.get(p.id);
                return {
                    id: p.id,
                    email: account?.email ?? null,
                    fullName: p.full_name,
                    role: p.role,
                    organization: p.organization,
                    orgRole: p.org_role,
                    invitedAt: account?.invited_at ?? null,
                    lastSignInAt: account?.last_sign_in_at ?? null,
                };
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    };
}

// Sends Supabase's invite email. Its link must point at /auth/confirm (see the Invite user
// email template in the Supabase dashboard), which signs them in and sends them to /set-password.
export async function inviteUser({
    email,
    fullName,
    role,
    organizationId,
    orgRoleId,
}: {
    email: string;
    fullName: string;
    role: role;
    organizationId: string;
    orgRoleId: string | null;
}): Promise<actionResult> {
    const user_ = await requireUser();
    if (!can(user_, "admin_area")) return denied("admin_area");
    const mismatch = (await checkRoleMatchesOrg(role, organizationId)) ?? (await checkRoleInOrg(orgRoleId, organizationId));
    if (mismatch) return { ok: false, error: mismatch };
    const admin = createAdminClient();

    const {data, error} = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (error) return fail(error);
    const { user } = data;
    if (!user) return { ok: false, error: "Invite failed: no user returned." };

    const { error: updateError } = await admin
        .from("profiles")
        .update({ role, organization_id: organizationId, org_role_id: orgRoleId })
        .eq("id", user.id);
    if (updateError) {
        await admin.auth.admin.deleteUser(user.id);
        return fail(updateError);
    }

    refresh();
    return { ok: true, data: undefined };
}

export async function updateUserRole({
    userId,
    role,
    organizationId,
    orgRoleId,
}: {
    userId: string;
    role: role;
    organizationId: string;
    orgRoleId: string | null;
}): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    // Changing your own role could lock the last Admin out of /admin.
    if (userId === user.id)
        return {
            ok: false,
            error: "You can't change your own role or organization.",
        };
    const mismatch = (await checkRoleMatchesOrg(role, organizationId)) ?? (await checkRoleInOrg(orgRoleId, organizationId));
    if (mismatch) return { ok: false, error: mismatch };

    // Service role: the profiles column grant (0003) only lets users edit their own full_name.
    const { error } = await createAdminClient()
        .from("profiles")
        .update({ role, organization_id: organizationId, org_role_id: orgRoleId })
        .eq("id", userId);
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Removes the profile, then the login. Profiles are referenced (no cascade) by results,
// executions, cases and sign-offs, so anyone with test activity is refused before anything is deleted.
export async function deleteUser({ userId }: { userId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    if (userId === user.id) return { ok: false, error: "You can't delete your own account." };

    const admin = createAdminClient();
    const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
    if (profileError) {
        if (profileError.code === "23503")
            return { ok: false, error: "This participant has test activity (results, cases or sign-offs), so they can't be deleted." };
        return fail(profileError);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Organizations -----------------------------------------------------------------

// RLS (0012) already lets Admins insert orgs, so the normal client is enough here.
export async function createOrg({
    name,
    type,
}: {
    name: string;
    type: orgType;
}): Promise<actionResult<{ id: string }>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Name is required." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("organizations")
        .insert({ name: trimmed, type })
        .select("id")
        .single();
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data.id } };
}

export async function renameOrg({ id, name }: { id: string; name: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Name is required." };

    const supabase = await createClient();
    const { error } = await supabase.from("organizations").update({ name: trimmed }).eq("id", id);
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Test roles ---------------------------------------------------------------------

// RLS (0051) limits writes to Admins; the unique index rejects a duplicate name in the same org.
export async function createOrgRole({
    organizationId,
    name,
}: {
    organizationId: string;
    name: string;
}): Promise<actionResult<orgRole>> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Role name is required." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("organization_roles")
        .insert({ organization_id: organizationId, name: trimmed })
        .select("id, name, organization_id")
        .single();
    if (error)
        return error.code === "23505" ? { ok: false, error: `"${trimmed}" already exists in this organization.` } : fail(error);
    refresh();
    return { ok: true, data: { id: data.id, name: data.name, organizationId: data.organization_id } };
}

// Users holding the role keep their org; their role is cleared (FK on delete set null).
export async function deleteOrgRole({ id }: { id: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");

    const supabase = await createClient();
    const { error } = await supabase.from("organization_roles").delete().eq("id", id);
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}
