"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"

// One section of a round, shaped by IterationSectionsTable.
export type iterationSectionRow = {
	id: string
	name: string
	// Cases of the section ticked to run in this round, out of every case the round holds for it.
	selected: number
	total: number
	// Test roles the selected cases need, i.e. who will be testing them.
	roles: string[]
}

const columnHelper = createColumnHelper<DataTableFeatures, iterationSectionRow>()

export const iterationSectionColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: "Testing Sections",
		cell: (info) => <p className="text-xs font-medium">{info.getValue()}</p>,
	}),
	columnHelper.accessor("selected", {
		header: "Selected test cases",
		cell: (info) => (
			<p><span className="font-semibold font-mono">{info.getValue()}</span> of <span className="font-mono font-semibold">{info.row.original.total}</span> test case{info.row.original.total === 1 ? "" : "s"} included</p>
		),
	}),
	columnHelper.accessor("roles", {
		header: "Participanting roles",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => {
			const roles = info.getValue()
			return roles.length > 0 ? (
				<div className="flex flex-row w-full gap-1">
					{roles.map((role) => (
						<span key={role} className="rounded-md py-0.5 px-1.5 bg-gray-600/5 text-xs text-gray-800">{role}</span>
					))}
				</div>
			) : <p className="text-xs text-muted-foreground">No roles</p>
		},
	}),
])
