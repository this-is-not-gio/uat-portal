"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { adminUser } from "@/lib/supabase/admin-actions";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { organization, orgRole, orgType } from "@/lib/supabase/organizations";
import { sameRoleName } from "@/lib/auth/test-role";
import { DataTable } from "@/components/table/data-table";
import { participantColumns } from "@/components/table/participant-columns";

const ALL = "__all__";

export function ParticipantsList({ users, organizations, roles }: {
	users: adminUser[];
	organizations: organization[];
	roles: orgRole[];
}) {
	const [role, setRole] = useState<string>(ALL);
	const [orgType, setOrgType] = useState<string>(ALL);
	const [orgId, setOrgId] = useState<string>(ALL);
	const [search, setSearch] = useState("");
	const columns = useMemo(() => participantColumns(roles), [roles]);

	// Every org has its own copy of a role (Action-Officer in each Internal org), so list each name once.
	const testRoles = roles.map((r) => r.name).filter((name, i, all) => all.findIndex((other) => sameRoleName(other, name)) === i).sort((a, b) => a.localeCompare(b));

	// The organization list narrows to the chosen org type.
	const typeOrgs = organizations.filter((org) => orgType === ALL || org.type === orgType);
	const query = search.trim().toLowerCase();
	const visibleUsers = users
		.filter((user) => role === ALL || sameRoleName(user.orgRole?.name, role))
		.filter((user) => orgType === ALL || user.organization?.type === orgType)
		.filter((user) => orgId === ALL || user.organization?.id === orgId)
		.filter((user) => !query || user.fullName.toLowerCase().includes(query) || (user.email ?? "").toLowerCase().includes(query));
	const orgName = organizations.find((org) => org.id === orgId)?.name;

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
								if (type !== ALL && organizations.find((org) => org.id === orgId)?.type !== type) setOrgId(ALL);
							}}
						>
							<SelectTrigger size="sm" className="w-fit text-xs">
								<SelectValue>{orgType === ALL ? "All Organization Types" : ORG_TYPE_LABELS[orgType as orgType]}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectItem value={ALL} className="text-xs">All Organization Types</SelectItem>
								{(Object.keys(ORG_TYPE_LABELS) as orgType[]).map((t) => <SelectItem key={t} value={t} className="text-xs">{ORG_TYPE_LABELS[t]}</SelectItem>)}
							</SelectContent>
						</Select>
						<p className="text-xs font-medium px-2 text-muted-foreground">Organization Type</p>
					</div>
					<div className="flex flex-col gap-1">
						<Select value={orgId} onValueChange={(value) => setOrgId(value ?? ALL)}>
							<SelectTrigger size="sm" className="w-48 text-xs">
								<SelectValue>{orgId === ALL ? "All organizations" : orgName}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectItem value={ALL} className="text-xs">All organizations</SelectItem>
								{typeOrgs.map((org) => <SelectItem key={org.id} value={org.id} className="text-xs">{org.name}</SelectItem>)}
							</SelectContent>
						</Select>
						<p className="text-xs font-medium px-2 text-muted-foreground">Organizations</p>
					</div>
					<div className="flex flex-col gap-1">
						<Select value={role} onValueChange={(value) => setRole(value ?? ALL)}>
							<SelectTrigger size="sm" className="w-36 text-xs">
								<SelectValue>{role === ALL ? "All roles" : role}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectItem value={ALL} className="text-xs">All roles</SelectItem>
								{testRoles.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
							</SelectContent>
						</Select>
						<p className="text-xs font-medium px-2 text-muted-foreground">Tester Roles</p>
					</div>


				</div>
				<div className="flex flex-row gap-2 items-center relative">
					<Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-8 text-xs md:text-xs" />
				</div>
			</div>
			<div className="border rounded-md">
				<DataTable
					columns={columns}
					data={visibleUsers}
					bordered={false}
					notEnd
					emptyTitle="No participants"
					emptyDescription="No participants match these filters."
				/>
			</div>
		</>
	);
}
