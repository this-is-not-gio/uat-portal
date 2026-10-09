"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import type { organization, orgRole } from "@/lib/supabase/organizations"
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels"
import { OrganizationActions } from "@/app/(app)/admin/organizations/organization-actions"
import { Users } from "lucide-react"

// One org on the Organizations tab, with its test roles (none for the vendor org) and tester accounts.
export type organizationRow = organization & { roles: orgRole[]; testerCount: number }

const columnHelper = createColumnHelper<DataTableFeatures, organizationRow>()

export const organizationColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: "Organization",
		cell: (info) => (
			<div>
				<p className="text-xs font-medium">{info.getValue()}</p>
			</div>
		),
	}),
	columnHelper.accessor("type", {
		header: "Type",
		cell: (info) => <p className="text-xs text-muted-foreground font-mono">{ORG_TYPE_LABELS[info.getValue()]}</p>
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
		cell: (info) => <OrganizationActions org={info.row.original} />,
	}),
])
