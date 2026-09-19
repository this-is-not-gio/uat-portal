"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { TestingSuites } from "@/lib/supabase/Init"
import { TestCase } from "../types"
import { Info, TestTubeDiagonal } from "lucide-react"
import { Badge } from "../ui/badge"

const columnHelper = createColumnHelper<DataTableFeatures, TestCase>()

export const columns = columnHelper.columns([
	// columnHelper.accessor("title", {
	// 	header: "Name",
	// 	cell: (info) => info.getValue(),
	// }),
	columnHelper.display({
		cell: (info) => (
			<div className="flex flex-row justify-between items-center gap-1">
				<div className="flex flex-row items-center gap-4">
					<TestTubeDiagonal data-icon="inline-start" size={15} className="text-gray-950" />
					<div className="">
						<div className="flex flex-row items-center gap-2">
							<p className="text-sm">{info.row.original.title}</p>
							<Badge variant="secondary" className="text-xs">{info.row.original.stepsToExecute?.length} steps</Badge>
						</div> 
						<p className="text-xs text-muted-foreground">{info.row.original.id}</p>
					</div>
				</div>
			</div>
		),
		header: "Test Cases",
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Role Assignee",
		cell: (info) => (
			<p className="text-xs text-muted-foreground">{info.getValue()}</p>
		)
	}),
	columnHelper.accessor("lane", {
		header: "Lane",
		cell: (info) => (
			<Badge variant={info.getValue() === "pass" ? "default" : info.getValue() === "fail" ? "destructive" : "secondary"} className="text-xs">
				<Info data-icon="inline-start" size={15} className="text-gray-950" />
				{info.getValue()}
			</Badge>
		)
	}),
	columnHelper.display({
		cell: (info) => (
			<div className="flex flex-col items-end justify-end gap-2">
				<p className="text-xs text-muted-foreground">Last week</p>
			</div>
		),
		header: "Priority",
	})
])
