import { IdCard } from "lucide-react";
import { getCatalogRoles, getOrganizations, getTesterCountsByRole } from "@/lib/supabase/organizations";
import { RolesList } from "./roles-list";
import { CreateRoleDialog } from "./create-role-dialog";

// The test role catalog: each role is defined once and given to the orgs that have it.
export default async function AdminRolesPage() {
	const [organizations, roles, testerCounts] = await Promise.all([getOrganizations(), getCatalogRoles(), getTesterCountsByRole()]);

	return (
		<div className="px-2 flex flex-col gap-4">
			<div className="flex flex-row justify-between items-center">
				<div className="flex flex-col gap-1">
					<div className="flex flex-row gap-2 items-center">
						<IdCard className="size-5 " />
						<p className="text-sm font-semibold">Roles</p>
					</div>
					<p className="text-xs text-muted-foreground">Manage the test role catalog and which organizations&apos; testers can hold each role.</p>
				</div>
				<CreateRoleDialog organizations={organizations.filter((org) => org.type !== "vendor")} />
			</div>
			<RolesList organizations={organizations} roles={roles} testerCounts={testerCounts} />
		</div>
	);
}
