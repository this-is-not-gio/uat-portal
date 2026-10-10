"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { CircleCheck, CircleOffIcon, CircleX, GitPullRequest, History, Info, MessageSquare, RefreshCw, RotateCcw, SkipForward, SquarePlus, Trash2, UserX, type LucideIcon } from "lucide-react"
import { Badge } from "../ui/badge"
import { TestStatusMapping } from "./columns"
// Type-only import: test-iterations.ts uses the server Supabase client.
import type { testResultRow } from "@/lib/supabase/test-iterations"
import { cn, initials } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

export type { testResultRow }

// A row's change flags: what vendor sync did to it this round (syncKind) or what's waiting
// for the next round (pendingChange). Same palette as the iteration table's ROUND_FLAG_STYLES.
export type resultChangeFlag = NonNullable<testResultRow["syncKind"]> | NonNullable<testResultRow["pendingChange"]>

// Highest priority first, for picking the one to show when a row has several.
export const RESULT_CHANGE_FLAG_ORDER: resultChangeFlag[] = ["removed", "audience_changed", "force_reset", "changed", "updated", "added"]

export const RESULT_CHANGE_FLAG_STYLES: Record<resultChangeFlag, { label: string; description: string; className: string; icon: LucideIcon }> = {
	removed: { label: "Removed", description: "The test case was deleted from the suite. It's out of this round; any results stay, view only.", className: "bg-red-50 text-red-800 border-red-600/40", icon: Trash2 },
	audience_changed: { label: "Role changed", description: "This organization no longer tests the test case's role. It's out of this round; any results stay, view only.", className: "bg-red-50 text-red-800 border-red-600/40", icon: UserX },
	force_reset: { label: "Reset by Development Team", description: "The Development Team reset this case's results mid-round.", className: "bg-red-50 text-red-800 border-red-600/40", icon: RotateCcw },
	changed: { label: "Outdated · retest next round", description: "The test case was edited after it was tested; the new version comes in the next iteration.", className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitPullRequest },
	updated: { label: "Updated", description: "The Development Team synced a newer version of this case into the round.", className: "bg-amber-50 text-amber-800 border-amber-600/40", icon: RefreshCw },
	added: { label: "Added mid-round", description: "The case was added to the round after it started.", className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: SquarePlus },
}

// How vendor sync touched this row mid-round (syncKind) or what's pending for it (pendingChange).
function SyncBadges({ row }: { row: testResultRow }) {
	const resetReason = row.archives[0]?.reason;
	return (
		<>
			{row.syncKind === "added" && <Badge variant="outline" className="text-xs border-blue-600/40 bg-blue-50 text-blue-800">Added mid-round</Badge>}
			{row.syncKind === "updated" && <Badge variant="outline" className="text-xs border-amber-600/40 bg-amber-50 text-amber-800">Updated</Badge>}
			{row.syncKind === "force_reset" && (
				<Badge variant="outline" className="text-xs border-red-600/40 bg-red-50 text-red-800" title={resetReason ? `Reason: ${resetReason}` : undefined}>
					Reset by Development Team{resetReason ? `: ${resetReason}` : ""}
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

// Every change flag on the row as an icon chip, highest priority first; the tooltip says what happened.
// Also used by the tester table, whose rows carry syncKind only (no pendingChange).
export function ChangeFlagsCell({ row }: { row: testResultRow }) {
	const flags = RESULT_CHANGE_FLAG_ORDER.filter((flag) => flag === row.syncKind || flag === row.pendingChange)
	if (flags.length === 0) return null
	const resetReason = row.archives[0]?.reason
	return (
		<div className="flex flex-row items-center justify-end gap-1">
			{flags.map((flag) => {
				const style = RESULT_CHANGE_FLAG_STYLES[flag]
				const Icon = style.icon
				return (
					<Tooltip key={flag}>
						<TooltipTrigger render={
							<div className={cn("rounded-md p-1", style.className)} aria-label={style.label}>
								<Icon size={15} />
							</div>
						} />
						<TooltipContent className="flex flex-col items-start gap-0.5 max-w-64">
							<p className="font-semibold">{style.label}</p>
							<p>{style.description}</p>
							{flag === "force_reset" && resetReason && <p>Reason: {resetReason}</p>}
						</TooltipContent>
					</Tooltip>
				)
			})}
		</div>
	)
}

// Remarks across every step of the case.
export function RemarkCountCell({ row }: { row: testResultRow }) {
	const remarkCount = (row.stepsToExecute ?? [])
		.reduce((count, step) => count + (step.remarks?.length ?? 0), 0);
	return (
		<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-100/50 w-fit">
			<MessageSquare size={15} className="text-gray-800" />
			<p className="font-mono text-xs text-gray-800">{remarkCount}</p>
		</div>
	);
}

// Step outcome counts; statuses with no steps are hidden.
export function ResultSummaryCell({ row }: { row: testResultRow }) {
	const steps = row.stepsToExecute ?? [];
	const passed = steps.filter((s) => s.status === "Passed").length;
	const failed = steps.filter((s) => s.status === "Failed").length;
	const skipped = steps.filter((s) => s.status === "Skipped").length;
	const blocked = steps.filter((s) => s.status === "Blocked").length;
	return (
		<div className="flex flex-row gap-1">
			{
				passed === 0 && failed === 0 && skipped === 0 && blocked === 0 && (
					<p className="text-xs text-muted-foreground">No results yet</p>
				)
			}
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

const columnHelper = createColumnHelper<DataTableFeatures, testResultRow>()

// " · Failed · Updated mid-round": the result (once tested) and the highest-priority change flag.
function mobileStatusText(row: testResultRow) {
	const flag = RESULT_CHANGE_FLAG_ORDER.find((f) => f === row.syncKind || f === row.pendingChange)
	return `${row.status !== "Untested" ? ` · ${row.status}` : ""}${flag ? ` · ${RESULT_CHANGE_FLAG_STYLES[flag].label}` : ""}`
}

export const testResultColumns = columnHelper.columns([
	columnHelper.display({
		header: "Test Case",
		cell: (info) => (
			<div>
				<div className="flex flex-row flex-wrap items-center gap-1">
					<p className="text-xs">{info.row.original.title}</p>
				</div>
				<p className="text-xs text-muted-foreground font-mono">
					{info.row.original.code}
					{/* Mobile hides the status column, so its result and top change flag ride on the code line as text. */}
					<span className="md:hidden">{mobileStatusText(info.row.original)}</span>
				</p>
			</div>
		),
	}),

	columnHelper.accessor("executor", {
		header: "Executed By",
		meta: { className: "hidden lg:table-cell" },
		cell: (info) => {
			const executor = info.getValue();
			if (!executor) return <p className="text-xs text-muted-foreground">—</p>;
			return (
				<div className="flex items-center gap-2">
					<div className="size-6 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
						<p className="text-xs font-semi-bold">{executor.full_name?.charAt(0) || 'U'}{executor.full_name?.charAt(1).toUpperCase() || 'U'}</p>
					</div>
					<div className="flex flex-col">
						<p className="text-xs font-semibold">{executor.full_name}</p>
						<p className="text-xs text-muted-foreground">{executor.role}</p>
					</div>
				</div>
			);
		},
	}),
	columnHelper.display({
		header: "Remarks",
		meta: { className: "hidden lg:table-cell" },
		cell: (info) => <RemarkCountCell row={info.row.original} />,
	}),

	columnHelper.display({
		header: "Result Summary",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => <ResultSummaryCell row={info.row.original} />,
	}),
	columnHelper.accessor("previousStatus", {
		meta: { className: "hidden lg:table-cell" },
		header: () => (
			<div className="flex flex-row items-center gap-1">
				<p>Last Iteration Results</p>
				<Tooltip>
					<TooltipTrigger>
						<Info size={15} className="text-muted-foreground" />
					</TooltipTrigger>
					<TooltipContent>
						<p className="text-xs">The result from the last iteration of this test case, if any.</p>
					</TooltipContent>
				</Tooltip>
			</div>
		),
		cell: (info) => {
			const previous = info.getValue();
			if (!previous) return <p className="text-xs text-muted-foreground">Not Tested Before</p>;
			const status = TestStatusMapping[previous];
			const Icon = status?.icon || Info;
			return (
				<div className={cn("rounded-md py-1 px-1.5 w-fit flex flex-row items-center gap-1.5", status?.className ?? "bg-gray-100 text-gray-800")}>
					<Icon size={12} />
					<p className="text-xs font-semibold whitespace-nowrap">{info.getValue()}</p>
				</div>
			);
		},
	}),
	columnHelper.accessor("status", {
		header: "",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => {
			// Same chip as the Test Cases tab's Result column (columns.tsx CaseResultCell), followed by the change flags.
			const status = TestStatusMapping[info.getValue() as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			return (
				<div className="flex items-center justify-end gap-2">
					{info.row.original.statusOverridden && (
						<Badge variant="outline" className="text-xs">Overridden</Badge>
					)}
					{
					    info.getValue() !== "Untested" ? (
							<div className={cn("rounded-md py-1 px-1.5 w-fit flex flex-row items-center gap-1.5", status?.className ?? "bg-gray-100 text-gray-800")}>
								<Icon size={12} />
								<p className="text-xs font-semibold whitespace-nowrap">{info.getValue()}</p>
							</div>
						) : null
					}
					<ChangeFlagsCell row={info.row.original} />
				</div>
			)
		},
	}),
])
