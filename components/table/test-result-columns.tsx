"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { CircleCheck, CircleOffIcon, CircleX, History, Info, MessageSquare, SkipForward } from "lucide-react"
import { Badge } from "../ui/badge"
import { TestStatusMapping } from "./columns"
// Type-only import: test-iterations.ts uses the server Supabase client.
import type { testResultRow } from "@/lib/supabase/test-iterations"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { initials } from "@/lib/utils"

export type { testResultRow }

// How vendor sync touched this row mid-round (syncKind) or what's pending for it (pendingChange).
function SyncBadges({ row }: { row: testResultRow }) {
	const resetReason = row.archives[0]?.reason;
	return (
		<>
			{row.syncKind === "added" && <Badge variant="outline" className="text-xs border-blue-600/40 bg-blue-50 text-blue-800">Added mid-round</Badge>}
			{row.syncKind === "updated" && <Badge variant="outline" className="text-xs border-amber-600/40 bg-amber-50 text-amber-800">Updated</Badge>}
			{row.syncKind === "force_reset" && (
				<Badge variant="outline" className="text-xs border-red-600/40 bg-red-50 text-red-800" title={resetReason ? `Reason: ${resetReason}` : undefined}>
					Reset by vendor{resetReason ? `: ${resetReason}` : ""}
				</Badge>
			)}
			{row.pendingChange === "changed" && (
				<Badge variant="outline" className="text-xs border-red-600/40 bg-red-50 text-red-800" title="The test case was edited after it was tested; the new version comes in the next iteration.">
					Outdated · retest next round
				</Badge>
			)}
			{row.pendingChange === "removed" && (
				<Badge variant="outline" className="text-xs" title="The test case was deleted from the suite; its results stay in this round.">Removed</Badge>
			)}
		</>
	);
}

const columnHelper = createColumnHelper<DataTableFeatures, testResultRow>()

export const testResultColumns = columnHelper.columns([
	columnHelper.display({
		header: "Test Case",
		cell: (info) => (
			<div>
				<div className="flex flex-row flex-wrap items-center gap-1">
					<p className="text-sm">{info.row.original.title}</p>
					<Badge variant="secondary" className="text-xs">{info.row.original.stepsToExecute?.length ?? 0} steps</Badge>
					<SyncBadges row={info.row.original} />
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
		cell: (info) => {
			const remarkCount = (info.row.original.stepsToExecute ?? [])
				.reduce((count, step) => count + (step.remarks?.length ?? 0), 0);
			return (
				<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-100/50 w-fit">
					<MessageSquare size={15} className="text-gray-800" />
					<p className="font-mono text-xs text-gray-800">{remarkCount}</p>
				</div>
			);
		},
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
	columnHelper.accessor("previousStatus", {
		header: "Last Round",
		cell: (info) => {
			const previous = info.getValue();
			if (!previous) return <p className="text-xs text-muted-foreground">—</p>;
			const status = TestStatusMapping[previous];
			const Icon = status?.icon || Info;
			return (
				<Badge variant="outline" className={`text-xs ${status?.className ?? ""}`}>
					<History data-icon="inline-start" size={13} />
					<Icon data-icon="inline-start" size={13} />
					{previous}
				</Badge>
			);
		},
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => {
			const status = TestStatusMapping[info.getValue() as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const variant = status?.variant || "outline";
			return (
				<div className="flex items-end justify-end gap-2">
					{info.row.original.statusOverridden && (
						<Badge variant="outline" className="text-xs">Overridden</Badge>
					)}
					<Badge className={`text-xs ${info.getValue() === "Passed" ? "bg-green-100 text-green-800" : ""}`} variant={variant || "outline"}>
						<Icon data-icon="inline-start" size={15} className={`text-${info.getValue() === "Passed" ? "green-800" : "gray-500"}`} />
						{info.getValue()}
					</Badge>
				</div>
			)
		},
	}),
])
