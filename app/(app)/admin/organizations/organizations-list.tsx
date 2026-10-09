"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/table/data-table";
import { organizationColumns } from "@/components/table/organization-columns";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { organization, orgRole, orgType } from "@/lib/supabase/organizations";

const ALL = "__all__";

// testerCounts: Internal/External accounts per org id (getTesterCountsByOrg).
export function OrganizationsList({ organizations, roles, testerCounts }: { organizations: organization[]; roles: orgRole[]; testerCounts: Record<string, number> }) {
	const [orgType, setOrgType] = useState<string>(ALL);
	const [search, setSearch] = useState("");

	const query = search.trim().toLowerCase();
	const rows = organizations
		.filter((org) => orgType === ALL || org.type === orgType)
		.filter((org) => !query || org.name.toLowerCase().includes(query))
		.map((org) => ({ ...org, roles: roles.filter((r) => r.organizationId === org.id), testerCount: testerCounts[org.id] ?? 0 }));

	return (
		<>
			<div className="flex flex-row justify-between gap-2">
				<div className="flex flex-col gap-1">
					<Select value={orgType} onValueChange={(value) => setOrgType(value ?? ALL)}>
						<SelectTrigger size="sm" className="w-fit text-xs">
							<SelectValue>{orgType === ALL ? "All Organization types" : ORG_TYPE_LABELS[orgType as orgType]}</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectItem value={ALL} className="text-xs">All Organization types</SelectItem>
							{(Object.keys(ORG_TYPE_LABELS) as orgType[]).map((t) => <SelectItem key={t} value={t} className="text-xs">{ORG_TYPE_LABELS[t]}</SelectItem>)}
						</SelectContent>
					</Select>
					<p className="text-xs font-medium px-2 text-muted-foreground">Organization Type</p>
				</div>
				<div className="relative w-full md:w-64 flex flex-row justify-between items-center">
					<Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organizations…" className="pl-8 text-xs md:text-xs" />
				</div>
			</div>
			<div className="border rounded-md">
				<DataTable
					columns={organizationColumns}
					data={rows}
					bordered={false}
					notEnd
					emptyTitle="No organizations"
					emptyDescription="No organizations match these filters."
				/>
			</div>
		</>
	);
}
