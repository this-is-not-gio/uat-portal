"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "./admin";
import { requireUser, type currentUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { actionResult } from "./iteration-actions";
import type { organization, orgType } from "./organizations";

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

// Users -----------------------------------------------------------------------

export type adminUser = {
    id: string;
    email: string | null;
    fullName: string;
    role: role;
    organization: organization | null;
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
                "id, full_name, role, organization:organizations(id, name, type)",
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
}: {
    email: string;
    fullName: string;
    role: role;
    organizationId: string;
}): Promise<actionResult> {
    const user_ = await requireUser();
    if (!can(user_, "admin_area")) return denied("admin_area");
    const mismatch = await checkRoleMatchesOrg(role, organizationId);
    if (mismatch) return { ok: false, error: mismatch };
    const admin = createAdminClient();

    const {data, error} = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (error) return fail(error);
    const { user } = data;
    if (!user) return { ok: false, error: "Invite failed: no user returned." };

    const { error: updateError } = await admin
        .from("profiles")
        .update({ role, organization_id: organizationId })
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
}: {
    userId: string;
    role: role;
    organizationId: string;
}): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "admin_area")) return denied("admin_area");
    // Changing your own role could lock the last Admin out of /admin.
    if (userId === user.id)
        return {
            ok: false,
            error: "You can't change your own role or organization.",
        };
    const mismatch = await checkRoleMatchesOrg(role, organizationId);
    if (mismatch) return { ok: false, error: mismatch };

    // Service role: the profiles column grant (0003) only lets users edit their own full_name.
    const { error } = await createAdminClient()
        .from("profiles")
        .update({ role, organization_id: organizationId })
        .eq("id", userId);
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
