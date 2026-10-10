"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import type { organization, orgType, testRole } from "@/lib/supabase/organizations"
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels"
import { RoleActions } from "@/app/(app)/admin/roles/role-actions"
import { Users } from "lucide-react"

// One catalog role on the Roles tab, with the orgs that have it and how many testers hold it in each.
export type roleRow = testRole & {
	orgs: { id: string; name: string; type: orgType; testerCount: number }[]
	testerCount: number
}

const columnHelper = createColumnHelper<DataTableFeatures, roleRow>()

function TesterCount({ count }: { count: number }) {
	return count > 0 ? <div className="flex flex-row gap-2 items-center px-2 py-1 rounded-md bg-gray-500/20 w-fit">
		<Users className="size-3" />
		<p className="text-xs font-medium "><span className="font-mono">{count}</span> Testers</p>
	</div> : <p className="text-xs text-muted-foreground">No Tester Yet</p>
}

// organizations: the Internal/External orgs offered in the Edit dialog.
export function roleColumns(organizations: organization[]) {
	return columnHelper.columns([
		columnHelper.accessor("name", {
			header: "Role",
			cell: (info) => <p className="text-xs font-medium">{info.getValue()}</p>,
		}),
		columnHelper.accessor("orgs", {
			header: "Organizations",
			cell: (info) => info.getValue().length ? (
				<div className="flex flex-col gap-1">
					{info.getValue().map((org) => (
						<p key={org.id} className="text-xs">
							<span className="font-semibold">{org.name}</span> - <span className="font-mono text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</span>
							<span className="text-muted-foreground"> · {org.testerCount} tester{org.testerCount === 1 ? "" : "s"}</span>
						</p>
					))}
				</div>
			) : <p className="text-xs text-muted-foreground">No organization yet</p>,
		}),
		columnHelper.accessor("testerCount", {
			header: "Number of testers",
			cell: (info) => <TesterCount count={info.getValue()} />,
		}),
		columnHelper.display({
			id: "actions",
			cell: (info) => <RoleActions role={info.row.original} organizations={organizations} />,
		}),
	])
}
