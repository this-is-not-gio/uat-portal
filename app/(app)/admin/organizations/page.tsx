import { getOrganizationRoles, getOrganizations, getTesterCountsByOrg, ORG_TYPE_LABELS } from "@/lib/supabase/organizations";
import { CreateOrgForm } from "./create-org-form";
import { OrgNameEditor } from "./org-roles-editor";
import { OrganizationsList } from "./organizations-list";
import { CreateOrgDialog } from "./create-org-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2 } from "lucide-react";

// Test roles are managed per org in the Create and Edit organization dialogs.
export default async function AdminOrganizationsPage() {
	const [organizations, roles, testerCounts] = await Promise.all([getOrganizations(), getOrganizationRoles(), getTesterCountsByOrg()]);

	return (
		<>
			{/* <h1 className="text-xl font-semibold">Organizations</h1>
			<CreateOrgForm />
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Test roles</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{organizations.map((org) => (
						<TableRow key={org.id}>
							<TableCell><OrgNameEditor org={org} /></TableCell>
							<TableCell>{ORG_TYPE_LABELS[org.type]}</TableCell>
							<TableCell className="text-muted-foreground">
								{org.type === "vendor" ? "—" : roles.filter((r) => r.organizationId === org.id).length}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table> */}
			<div className="px-2 flex flex-col gap-4">
				<div className="flex flex-row justify-between items-center">
					<div className="flex flex-col gap-1">
						<div className="flex flex-row gap-2 items-center">
							<Building2 className="size-5 " />
							<p className="text-sm font-semibold">Organization</p>
						</div>
						<p className="text-xs text-muted-foreground">Manage your organization and its details.</p>
					</div>
					<CreateOrgDialog />
				</div>
				<OrganizationsList organizations={organizations} roles={roles} testerCounts={testerCounts} />
			</div>
		</>
	);
}
