"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/table/data-table";
import { roleColumns, type roleRow } from "@/components/table/role-columns";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { catalogRole, organization, orgType } from "@/lib/supabase/organizations";

const ALL = "__all__";

// One row per catalog role. testerCounts: profiles per org role id (getTesterCountsByRole).
export function RolesList({ organizations, roles, testerCounts }: {
	organizations: organization[];
	roles: catalogRole[];
	testerCounts: Record<string, number>;
}) {
	const [orgType, setOrgType] = useState<string>(ALL);
	const [orgId, setOrgId] = useState<string>(ALL);
	const [search, setSearch] = useState("");

	// The vendor org doesn't test, so it has no roles and isn't offered here.
	const testingOrgs = organizations.filter((org) => org.type !== "vendor");
	const typeOrgs = testingOrgs.filter((org) => orgType === ALL || org.type === orgType);
	const orgById = new Map(organizations.map((org) => [org.id, org]));
	const columns = useMemo(() => roleColumns(organizations.filter((org) => org.type !== "vendor")), [organizations]);
	const query = search.trim().toLowerCase();
	const rows: roleRow[] = roles.map((role) => {
		const orgs = role.instances.flatMap((instance) => {
			const org = orgById.get(instance.organizationId);
			return org ? [{ id: org.id, name: org.name, type: org.type, testerCount: testerCounts[instance.id] ?? 0 }] : [];
		});
		orgs.sort((a, b) => a.name.localeCompare(b.name));
		return { id: role.id, name: role.name, orgs, testerCount: orgs.reduce((sum, org) => sum + org.testerCount, 0) };
	})
		.filter((row) => orgType === ALL || row.orgs.some((org) => org.type === orgType))
		.filter((row) => orgId === ALL || row.orgs.some((org) => org.id === orgId))
		.filter((row) => !query || row.name.toLowerCase().includes(query));
	const orgName = orgById.get(orgId)?.name;

	return (
		<>
			<div className="flex flex-row flex-wrap justify-between gap-2">
				<div className="flex flex-row gap-2">
					<div className="flex flex-col gap-1">
						<Select
							value={orgType}
							onValueChange={(value) => {
								const type = value ?? ALL;
								setOrgType(type);
								// Drop an org pick that no longer belongs to the chosen type.
								if (type !== ALL && orgById.get(orgId)?.type !== type) setOrgId(ALL);
							}}>
							<SelectTrigger size="sm" className="w-fit text-xs">
								<SelectValue>{orgType === ALL ? "All Organization types" : ORG_TYPE_LABELS[orgType as orgType]}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectItem value={ALL} className="text-xs">All Organization types</SelectItem>
								{(["client", "external"] as orgType[]).map((t) => <SelectItem key={t} value={t} className="text-xs">{ORG_TYPE_LABELS[t]}</SelectItem>)}
							</SelectContent>
						</Select>
						<p className="text-xs font-medium px-2 text-muted-foreground">Organization Type</p>
					</div>
					<div className="flex flex-col gap-1">
						<Select value={orgId} onValueChange={(value) => setOrgId(value ?? ALL)}>
							<SelectTrigger size="sm" className="w-fit text-xs">
								<SelectValue>{orgId === ALL ? "All organizations" : orgName}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectItem value={ALL} className="text-xs">All organizations</SelectItem>
								{typeOrgs.map((org) => <SelectItem key={org.id} value={org.id} className="text-xs">{org.name}</SelectItem>)}
							</SelectContent>
						</Select>
						<p className="text-xs font-medium px-2 text-muted-foreground">Organizations</p>
					</div>
				</div>
				<div className="flex flex-row justify-between items-center relative w-full md:w-64">
					<Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roles…" className="pl-8 text-xs md:text-xs" />
				</div>
			</div>
			<div className="border rounded-md">
				<DataTable
					columns={columns}
					data={rows}
					bordered={false}
					notEnd
					emptyTitle="No roles"
					emptyDescription="No test roles match these filters."
				/>
			</div>
		</>
	);
}
