"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { TestingSuites } from "@/lib/supabase/Init"
import { TestCase } from "../types"
import { CircleCheck, CircleX, Info, TestTube, TestTubeDiagonal, TestTubes } from "lucide-react"
import { Badge } from "../ui/badge"
import { testCase } from "@/lib/supabase/test-cases"
import { cn, humanizeTimestamp } from "@/lib/utils"


// export type testCaseStatus = "Untested" | "In Progress" | "Passed" | "Failed";
const TestStatusMapping = {
	"Untested": {
		icon: TestTubes,
		variant: "outline",
		className: "bg-gray-100 text-gray-800",
	},
	"In Progress": {
		icon: TestTubeDiagonal,
		variant: "secondary",
		className: "bg-gray-100 text-gray-800",
	},
	"Passed": {
		icon: CircleCheck,
		variant: "default",
		className: "bg-green-100 text-green-800",
	},
	"Failed": {
		icon: CircleX,
		variant: "destructive",
		className: "bg-red-100 text-red-800",
	}
} as const



const columnHelper = createColumnHelper<DataTableFeatures, testCase>()

export const columns = columnHelper.columns([
	columnHelper.display({
		cell: (info) => {
			const status = TestStatusMapping[info.row.original.status as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const classNameVariant = status?.className || "bg-gray-100 text-gray-800";
			return (
				<div className="flex flex-row justify-between items-center gap-1">
					<div className="flex flex-row items-center gap-4">
							<Icon data-icon="inline-start" size={15} className={`text-${info.row.original.status === "Passed" ? "green-800" : info.row.original.status === "Failed" ? "red-500" : "gray-500"}`} />
						<div className="">
							<div className="flex flex-row items-center gap-2">
								<p className="text-sm">{info.row.original.title}</p>
								<Badge variant="secondary" className="text-xs">{info.row.original.stepsToExecute?.length ?? 0} steps</Badge>
							</div>
							<p className="text-xs text-muted-foreground">{info.row.original.code}</p>
							{/* <p className="text-xs text-muted-foreground">{info.row.original.id}</p> */}
						</div>
					</div>
				</div>
			)
		},
		header: "Test Cases",
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Role Assignee",
		cell: (info) => (
			<p className="text-xs text-muted-foreground">{info.getValue()}</p>
		)
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => {
			const status = TestStatusMapping[info.getValue() as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const variant = status?.variant || "outline";
			return (
				<Badge className={`text-xs ${info.getValue() === "Passed" ? "bg-green-100 text-green-800" : ""}`} variant={variant || "outline"}>
					<Icon data-icon="inline-start" size={15} className={`text-${info.getValue() === "Passed" ? "green-800" : "gray-500"}`} />
					{info.getValue()}
				</Badge>
			)
		}
	}),
	columnHelper.display({
		cell: (info) => (
			<div className="flex flex-col items-end justify-end gap-2">
				<p className="text-xs text-muted-foreground">{humanizeTimestamp(info.row.original.created_at)}</p>
			</div>
		),
		header: "Timestamp",
	})
])
