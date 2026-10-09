"use client";

import type { organization, orgRole, orgType } from "@/lib/supabase/organizations";
import type { currentUser } from "@/lib/supabase/auth";

type role = currentUser["role"];

export type roleOrgValue = { role: role; organizationId: string; orgRoleId: string | null };

export const ROLES: role[] = ["Admin", "Internal", "External"];
const ROLE_ORG_TYPE: Record<role, orgType> = { Admin: "vendor", Internal: "client", External: "external" };

// The org list follows the role (Admin → vendor, Internal → client, External → companies);
// the server re-checks this in admin-actions.
export function orgsForRole(organizations: organization[], role: role) {
	return organizations.filter((org) => org.type === ROLE_ORG_TYPE[role]);
}

// Test role is optional and scoped to the org, so it resets whenever the org changes.
export function RoleOrgFields({ role, organizationId, orgRoleId, organizations, roles, onChange }: roleOrgValue & {
	organizations: organization[];
	roles: orgRole[];
	onChange: (next: roleOrgValue) => void;
}) {
	const options = orgsForRole(organizations, role);
	const orgRoles = roles.filter((r) => r.organizationId === organizationId);
	return (
		<div className="flex gap-2">
			<select
				className="rounded-md border px-2 py-1 text-sm"
				value={role}
				onChange={(e) => {
					const nextRole = e.target.value as role;
					onChange({ role: nextRole, organizationId: orgsForRole(organizations, nextRole)[0]?.id ?? "", orgRoleId: null });
				}}>
				{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
			</select>
			<select
				className="rounded-md border px-2 py-1 text-sm"
				value={organizationId}
				onChange={(e) => onChange({ role, organizationId: e.target.value, orgRoleId: null })}>
				{options.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
			</select>
			{orgRoles.length > 0 && (
				<select
					className="rounded-md border px-2 py-1 text-sm"
					value={orgRoleId ?? ""}
					onChange={(e) => onChange({ role, organizationId, orgRoleId: e.target.value || null })}>
					<option value="">No test role</option>
					{orgRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
				</select>
			)}
		</div>
	);
}
