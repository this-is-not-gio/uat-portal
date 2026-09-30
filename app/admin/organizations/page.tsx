import { getOrganizations } from "@/lib/supabase/organizations";
import { CreateOrgForm } from "./create-org-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminOrganizationsPage() {
	const organizations = await getOrganizations();

	return (
		<>
			<h1 className="text-xl font-semibold">Organizations</h1>
			<CreateOrgForm />
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Type</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{organizations.map((org) => (
						<TableRow key={org.id}>
							<TableCell>{org.name}</TableCell>
							<TableCell className="capitalize">{org.type}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</>
	);
}
