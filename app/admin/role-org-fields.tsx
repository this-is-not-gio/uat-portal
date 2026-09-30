"use client";

import type { organization, orgType } from "@/lib/supabase/organizations";
import type { currentUser } from "@/lib/supabase/auth";

type role = currentUser["role"];

export const ROLES: role[] = ["Admin", "Internal", "External"];
const ROLE_ORG_TYPE: Record<role, orgType> = { Admin: "vendor", Internal: "client", External: "external" };

// The org list follows the role (Admin → vendor, Internal → client, External → companies);
// the server re-checks this in admin-actions.
export function orgsForRole(organizations: organization[], role: role) {
	return organizations.filter((org) => org.type === ROLE_ORG_TYPE[role]);
}

export function RoleOrgFields({ role, organizationId, organizations, onChange }: {
	role: role;
	organizationId: string;
	organizations: organization[];
	onChange: (next: { role: role; organizationId: string }) => void;
}) {
	const options = orgsForRole(organizations, role);
	return (
		<div className="flex gap-2">
			<select
				className="rounded-md border px-2 py-1 text-sm"
				value={role}
				onChange={(e) => {
					const nextRole = e.target.value as role;
					onChange({ role: nextRole, organizationId: orgsForRole(organizations, nextRole)[0]?.id ?? "" });
				}}>
				{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
			</select>
			<select
				className="rounded-md border px-2 py-1 text-sm"
				value={organizationId}
				onChange={(e) => onChange({ role, organizationId: e.target.value })}>
				{options.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
			</select>
		</div>
	);
}
