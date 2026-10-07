"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { Badge } from "../ui/badge"
import { Checkbox } from "../ui/checkbox"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card"
import { Ban, CircleCheck, CircleX, ClipboardCheck, GitBranchPlus, GitCompare, GitPullRequest, Info, MoreHorizontal, Scissors, TestTubes, Trash2, TriangleAlert, Waypoints, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { roundFlagLabel, type roundCaseFlag, type roundFlag } from "@/lib/supabase/case-states"
import { TestStatusMapping } from "./columns"
// Type-only import: test-iterations.ts uses the server Supabase client.
import type { testResultRow } from "@/lib/supabase/test-iterations"
import type { testCase, testCaseStatus } from "@/lib/supabase/test-cases"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { AudienceBadge } from "../audience-badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Button } from "../ui/button"

// One participating org's copy of a case in the round.
export type iterationOrgResult = { resultId: string; organizationId: string; organizationName: string; status: testCaseStatus; includedInRun: boolean }
// A round has one result row per case per org; the table shows one row per case
// (the first org's row as the base) with every org's result alongside.
export type iterationCaseRow = testResultRow & { orgResults: iterationOrgResult[]; roundFlags: roundCaseFlag[] }

const columnHelper = createColumnHelper<DataTableFeatures, iterationCaseRow>()

// Same palette as the Test Cases tab's flags (columns.tsx TestCaseFlags).
const ROUND_FLAG_STYLES: Record<roundFlag, { className: string; icon: LucideIcon }> = {
	incomplete: { className: "bg-amber-50 text-amber-800 border-amber-600/40", icon: TriangleAlert },
	removed: { className: "bg-red-50 text-red-800 border-red-600/40", icon: Trash2 },
	update_pending: { className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitCompare },
	changed_after_testing: { className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitPullRequest },
	failed: { className: "bg-red-50 text-red-800 border-red-600/40", icon: CircleX },
	blocked: { className: "bg-gray-100 text-gray-800 border-gray-600/40", icon: Ban },
	skipped: { className: "bg-gray-50 text-gray-800 border-gray-600/40", icon: Scissors },
	tested: { className: "bg-green-50 text-green-800 border-green-600/40", icon: CircleCheck },
	changed_since: { className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitBranchPlus },
	not_tested: { className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: TestTubes },
}

function RoundFlagsCell({ flags }: { flags: roundCaseFlag[] }) {
	if (flags.length === 0) return null
	return (
		<div className="flex flex-row flex-wrap items-center gap-1">
			{flags.map((flag) => {
				const style = ROUND_FLAG_STYLES[flag.flag]
				const Icon = style.icon
				// <div key={flag.flag} className={cn("w-fit rounded-md border py-0.5 px-1.5 flex flex-row items-center gap-1", style.className)}>
				// 	<style.icon size={12} />
				// 	<p className="text-xs font-semibold whitespace-nowrap">{roundFlagLabel(flag)}</p>
				// </div>
				return (
					<Tooltip key={flag.flag}>
						<TooltipTrigger render={<div className={cn("rounded-md p-1", style.className)}>
							<Icon size={15} />
						</div>} />
						<TooltipContent>
							{roundFlagLabel(flag)}
						</TooltipContent>
					</Tooltip>
				)
			})}
		</div>
	)
}

function TestCaseTitleCell({
	row,
	selected,
	indeterminate,
	onToggle,
	disabled,
}: {
	row: testCase;
	selected?: boolean;
	indeterminate?: boolean;
	onToggle?: (checked: boolean) => void;
	// Round already started (case set locked): no checkbox, unticked cases just stay faded.
	disabled?: boolean;
}) {
	// Only meaningful in a selectable table: an unticked case isn't part of the round.
	const isExcluded = !!onToggle && !selected && !indeterminate;
	const status = TestStatusMapping[row.status as keyof typeof TestStatusMapping];
	const Icon = status?.icon || Info;

	return (
		<div className="flex flex-row justify-between items-center gap-1">
			<div className="flex flex-row items-center gap-4">
				<div className="flex flex-row gap-2">
					<div className="flex flex-row items-center gap-4">
						{
							onToggle && !disabled && (
								<Checkbox
									checked={selected}
									indeterminate={indeterminate}
									onCheckedChange={(checked) => onToggle(checked === true)}
									onClick={(event) => event.stopPropagation()}
									aria-label={`Select ${row.title} for testing`}
								/>
							)
						}
						<div className={`flex flex-row items-center gap-3 ${isExcluded ? "opacity-50" : ""}`}>
							<div className="">
								<p className="text-xs">{row.title}</p>
								{row.lifecycleStatus === "updated" && (
									<Badge variant="outline" className="text-xs">Updated</Badge>
								)}
								<p className="text-xs text-muted-foreground font-mono">{row.code}</p>
							</div>
							{/* <div className="flex flex-row items-center gap-2">
								<Tooltip>
									<TooltipTrigger render={
										<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
											<Waypoints size={15} className="text-gray-800" />
											{row.stepsToExecute?.length}
										</div>
									} />
									<TooltipContent className="w-fit flex flex-col gap-3" side="bottom">
										Steps to execute
									</TooltipContent>
								</Tooltip>
								{
									row.preconditions?.length === 0 ?
										<div className="flex flex-row items-center gap-2">
											<HoverCard>
												<HoverCardTrigger render={
													<div className="flex flex-row items-center gap-1 rounded-md p-1.5 bg-blue-600/5 w-fit">
														<Info size={15} className="text-blue-800" />
													</div>
												} />
												<HoverCardContent className="w-fit p-4 flex flex-col gap-3">
													<div className="flex flex-row items-start gap-2">
														<div className="bg-blue-600/5 rounded-md p-2 w-fit">
															<Info className="text-blue-800 size-5" />
														</div>
														<div className="">
															<p className="font-semibold text-sm">Notice</p>
															<p className="text-xs">This problem may affect the test execution.</p>
														</div>
													</div>
													<div className="">
														<p className="text-xs">Problems:</p>
														<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
															<li>No preconditions defined for this test case</li>
														</ul>
													</div>
												</HoverCardContent>
											</HoverCard>
										</div>
										:
										<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
											<ClipboardCheck size={15} className="text-gray-800" />
											<p className="font-mono text-xs text-gray-800">{row.preconditions?.length}</p>
										</div>
								}
							</div> */}
							{/* <Badge variant="outline" className={`text-xs ${status?.className || ""}`}>
								{row.stepsToExecute?.length} Steps
							</Badge> */}
						</div>

						{/* Set by the Test Cases tab while a round runs: where this live case stands vs the round. */}
					</div>
				</div>
			</div>
		</div >
	)
}

// A function (not a static array) since the checkbox needs to share selection
// state with whatever renders this table — pass the currently-selected ids
// and a toggle callback, refreshed on every render.
export function createIterationTestCaseColumns({
	selectedIds,
	onToggle,
	allSelected,
	someSelected,
	onToggleAll,
	disabled,
	showFlags = false,
}: {
	// The round's case set is locked once it starts: checkboxes hide, unticked rows stay faded.
	disabled?: boolean;
	// Flags column (a round's section page only).
	showFlags?: boolean;
	selectedIds?: Set<string>;
	onToggle?: (row: iterationCaseRow, checked: boolean) => void;
	allSelected?: boolean;
	someSelected?: boolean;
	onToggleAll?: (checked: boolean) => void;
}) {
	return columnHelper.columns([
		columnHelper.display({
			id: "testCase",
			header: () => (
				onToggleAll && !disabled ? (
					<div className="flex flex-row items-center gap-4">
						<Checkbox
							checked={allSelected}
							indeterminate={someSelected && !allSelected}
							onCheckedChange={(checked) => onToggleAll(checked === true)}
							aria-label="Select all test cases"
						/>
						<p>Test Case</p>
					</div>
				) : "Test Case"
			),
			cell: (info) => {
				const row = info.row.original
				const selectedCount = row.orgResults.filter((result) => selectedIds?.has(result.resultId)).length
				return (
					<TestCaseTitleCell
						row={row}
						selected={selectedCount > 0 && selectedCount === row.orgResults.length}
						indeterminate={selectedCount > 0 && selectedCount < row.orgResults.length}
						onToggle={onToggle ? (checked) => onToggle(row, checked) : undefined}
						disabled={disabled}
					/>
				)
			},
		}),
		columnHelper.accessor("preconditions", {
			header: "Preconditions",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => {
				if (info.getValue()?.length === 0) {
					return <div className="flex flex-row items-center gap-2 justify-between">
						<p className="font-mono text-xs text-muted-foreground">—</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1 rounded-md p-1 bg-blue-600/5 w-fit">
									<Info size={15} className="text-blue-800" />
								</div>
							} />
							<HoverCardContent className="w-fit p-4 flex flex-col gap-3">
								<div className="flex flex-row items-start gap-2">
									<div className="bg-blue-600/5 rounded-md p-2 w-fit">
										<Info className="text-blue-800 size-5" />
									</div>
									<div className="">
										<p className="font-semibold text-sm">Notice</p>
										<p className="text-xs">This problem may affect the test execution.</p>
									</div>
								</div>
								<div className="">
									<p className="text-xs">Problems:</p>
									<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
										<li>No preconditions defined for this test case</li>
									</ul>
								</div>
							</HoverCardContent>
						</HoverCard>
					</div>
				} else {
					return <div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
						<ClipboardCheck size={15} className="text-gray-800" />
						<div className="flex flex-row items-center gap-0.5">
							<p className="font-mono text-xs text-gray-800">{info.getValue()?.length}</p>
						</div>
					</div>
				}
				//return <p className="text-xs font-medium text-muted-foreground">{info.getValue()?.length}</p>
			}
		}),
		columnHelper.accessor("stepsToExecute", {
			header: "Steps to Execute",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => {
				const steps = info.getValue() ?? [];
				return (
					<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
						<Waypoints size={15} className="text-gray-800" />
						<div className="flex flex-row items-center gap-0.5">
							<p className="font-mono text-xs text-gray-800">{steps.length}</p>
							<p className="text-xs text-gray-800 font-semibold">Steps</p>
						</div>
					</div>
				)
			}
		}),
		columnHelper.accessor("audience", {
			header: "Audience",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => {
				const value = info.getValue()
				return value ? <AudienceBadge audience={value} /> : null
			}
		}),
		columnHelper.accessor("roleAssignee", {
			header: "Role Assignee",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => (
				<p className="text-xs font-medium text-muted-foreground">{info.getValue()}</p>
			)
		}),
		...(showFlags ? [columnHelper.accessor("roundFlags", {
			header: "",
			cell: (info) => 
				<div className="flex flex-row justify-end">
					<RoundFlagsCell flags={info.getValue()} />
				</div>
		})] : []),
	])
}
