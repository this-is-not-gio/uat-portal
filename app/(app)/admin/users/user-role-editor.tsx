"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateUserRole, type adminUser } from "@/lib/supabase/admin-actions";
import type { organization, orgRole } from "@/lib/supabase/organizations";
import { RoleOrgFields } from "../role-org-fields";

export function UserRoleEditor({ user, organizations, roles }: { user: adminUser; organizations: organization[]; roles: orgRole[] }) {
	const initial = { role: user.role, organizationId: user.organization?.id ?? "", orgRoleId: user.orgRole?.id ?? null };
	const [roleOrg, setRoleOrg] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const dirty = roleOrg.role !== initial.role || roleOrg.organizationId !== initial.organizationId || roleOrg.orgRoleId !== initial.orgRoleId;

	return (
		<div className="flex items-center gap-2">
			<RoleOrgFields {...roleOrg} organizations={organizations} roles={roles} onChange={setRoleOrg} />
			{dirty && (
				<Button
					size="sm"
					disabled={pending || !roleOrg.organizationId}
					onClick={() => startTransition(async () => {
						const result = await updateUserRole({ userId: user.id, ...roleOrg });
						setError(result.ok ? null : result.error);
					})}>
					{pending ? "Saving..." : "Save"}
				</Button>
			)}
			{error && <span className="text-sm text-destructive">{error}</span>}
		</div>
	);
}
