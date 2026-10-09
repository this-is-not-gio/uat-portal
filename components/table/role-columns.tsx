"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import type { orgRole, orgType } from "@/lib/supabase/organizations"
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels"
import { RoleActions } from "@/app/(app)/admin/roles/role-actions"
import { info } from "console"
import { Users } from "lucide-react"


// One test role on the Roles tab, with its org and how many testers hold it.
export type roleRow = orgRole & { orgName: string; orgType: orgType; testerCount: number }

const columnHelper = createColumnHelper<DataTableFeatures, roleRow>()

export const roleColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: "Role",
		cell: (info) => <p className="text-xs font-medium">{info.getValue()}</p>,
	}),
	columnHelper.accessor("orgName", {
		header: "Organization",
		cell: (info) => (
			<div>
				<p className="text-xs font-semibold">{info.getValue()} - <span className="font-mono text-muted-foreground">{ORG_TYPE_LABELS[info.row.original.orgType]}</span></p>
			</div>
		),
	}),
	columnHelper.accessor("testerCount", {
		header: "Number of testers",
		cell: (info) => info.getValue() > 0 ? <div className="flex flex-row gap-2 items-center px-2 py-1 rounded-md bg-gray-500/20 w-fit">
				<Users className="size-3" />
				<p className="text-xs font-medium "><span className="font-mono">{info.getValue()}</span> Testers</p>
			</div> : <p className="text-xs text-muted-foreground">No Tester Yet</p>,
	}),
	columnHelper.display({
		id: "actions",
		cell: (info) => <RoleActions role={info.row.original} />,
	}),
])
