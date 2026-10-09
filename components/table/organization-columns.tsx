"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import type { organization, orgRole } from "@/lib/supabase/organizations"
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels"
import { OrganizationActions } from "@/app/(app)/admin/organizations/organization-actions"

// One org on the Organizations tab, with its test roles (none for the vendor org).
export type organizationRow = organization & { roles: orgRole[] }

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
		cell: (info) => ORG_TYPE_LABELS[info.getValue()],
	}),
	columnHelper.accessor((org) => org.roles.map((r) => r.name), {
		id: "roles",
		header: "Test roles",
		cell: (info) => {
			const org = info.row.original
			if (org.type === "vendor") return <span className="text-muted-foreground">—</span>
			const names = info.getValue()
			return names.length ? (
				<div className="flex flex-wrap gap-1">
					{names.map((name) => <span key={name} className="rounded-md bg-gray-600/5 px-1.5 py-0.5 text-xs text-gray-800">{name}</span>)}
				</div>
			) : <span className="text-muted-foreground">No roles yet</span>
		},
	}),
	columnHelper.display({
		id: "actions",
		cell: (info) => <OrganizationActions org={info.row.original} roles={info.row.original.roles} />,
	}),
])
