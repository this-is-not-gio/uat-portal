"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { CircleCheck, CircleOffIcon, CircleX, Info, MessageSquare, SkipForward } from "lucide-react"
import { Badge } from "../ui/badge"
import { TestStatusMapping } from "./columns"
import { testCase, type profile } from "@/lib/supabase/test-cases"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { initials } from "@/lib/utils"

// Reuses the real testCase shape (status, roleAssignee, stepsToExecute with
// each step's own remarks) instead of a flat ad-hoc shape, so a result row
// carries real step/remark data. executor/completedAt are genuinely extra
// for a "result" context. executor is a full `profile` (not just a name)
// so its `role` can distinguish an Internal vs an External executor.
export type testResultRow = testCase & {
	executor?: profile;
	completedAt: string;
}

const columnHelper = createColumnHelper<DataTableFeatures, testResultRow>()

export const testResultColumns = columnHelper.columns([
	columnHelper.display({
		header: "Test Case",
		cell: (info) => (
			<div>
				<div className="flex flex-row gap-1">
					<p className="text-sm">{info.row.original.title}</p>
					<Badge variant="secondary" className="text-xs">{info.row.original.stepsToExecute?.length ?? 0} steps</Badge>
				</div>
				<p className="text-xs text-muted-foreground">{info.row.original.code}</p>
			</div>
		),
	}),

	columnHelper.accessor("executor", {
		header: "Executed By",
		cell: (info) => {
			const executor = info.getValue();
			if (!executor) return <p className="text-xs text-muted-foreground">—</p>;
			return (
				<div className="flex items-center gap-2">
					<div className="size-6 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
						<p className="text-xs font-semi-bold">{executor.full_name?.charAt(0) || 'U'}{executor.full_name?.charAt(1).toUpperCase() || 'U'}</p>
					</div>
					<div className="flex flex-col">
						<p className="text-sm">{executor.full_name}</p>
						<p className="text-xs text-muted-foreground">{executor.role}</p>
					</div>
				</div>
			);
		},
	}),
	columnHelper.display({
		header: "Remarks",
		cell: (info) => (
			<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-100/50 w-fit">
				<MessageSquare size={15} className="text-gray-800" />
				<p className="font-mono text-xs text-gray-800">2</p>
			</div>
		),
	}),

	columnHelper.display({
		header: "Result Summary",
		cell: (info) => {
			const steps = info.row.original.stepsToExecute ?? [];
			const passed = steps.filter((s) => s.status === "Passed").length;
			const failed = steps.filter((s) => s.status === "Failed").length;
			const skipped = steps.filter((s) => s.status === "Skipped").length;
			const blocked = steps.filter((s) => s.status === "Blocked").length;
			return (
				<div className="flex flex-row gap-1">
					{passed > 0 && (
						<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-green-600/20 w-fit">
							<CircleCheck size={15} className="text-green-800" />
							<p className="font-mono text-xs text-green-800">{passed}</p>
						</div>
					)}
					{failed > 0 && (
						<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-red-600/20 w-fit">
							<CircleX size={15} className="text-red-800" />
							<p className="font-mono text-xs text-red-800">{failed}</p>
						</div>
					)}
					{skipped > 0 && (
						<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/20 w-fit">
							<SkipForward size={15} className="text-gray-800" />
							<p className="font-mono text-xs text-gray-800">{skipped}</p>
						</div>
					)}
					{blocked > 0 && (
						<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/20 w-fit">
							<CircleOffIcon size={15} className="text-gray-800" />
							<p className="font-mono text-xs text-gray-800">{blocked}</p>
						</div>
					)}
				</div>
			);
		}
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => {
			const status = TestStatusMapping[info.getValue() as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const variant = status?.variant || "outline";
			return (
				<div className="flex items-end justify-end gap-2">
					<Badge className={`text-xs ${info.getValue() === "Passed" ? "bg-green-100 text-green-800" : ""}`} variant={variant || "outline"}>
						<Icon data-icon="inline-start" size={15} className={`text-${info.getValue() === "Passed" ? "green-800" : "gray-500"}`} />
						{info.getValue()}
					</Badge>
				</div>
			)
		},
	}),
])
