import { IdCard } from "lucide-react";
import { getOrganizationRoles, getOrganizations, getTesterCountsByRole } from "@/lib/supabase/organizations";
import { RolesList } from "./roles-list";
import { CreateRoleDialog } from "./create-role-dialog";

// Every org's test roles in one list (org type → org → role). Roles can also be edited per org
// from the Organization tab's Edit dialog.
export default async function AdminRolesPage() {
	const [organizations, roles, testerCounts] = await Promise.all([getOrganizations(), getOrganizationRoles(), getTesterCountsByRole()]);

	return (
		<div className="px-2 flex flex-col gap-4">
			<div className="flex flex-row justify-between items-center">
				<div className="flex flex-col gap-1">
					<div className="flex flex-row gap-2 items-center">
						<IdCard className="size-5 " />
						<p className="text-sm font-semibold">Roles</p>
					</div>
					<p className="text-xs text-muted-foreground">Manage the test roles each organization&apos;s testers can have.</p>
				</div>
				<CreateRoleDialog organizations={organizations} />
			</div>
			<RolesList organizations={organizations} roles={roles} testerCounts={testerCounts} />
		</div>
	);
}
