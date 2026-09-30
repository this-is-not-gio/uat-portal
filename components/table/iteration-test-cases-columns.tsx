"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { Badge } from "../ui/badge"
import { Checkbox } from "../ui/checkbox"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card"
import { ClipboardCheck, Info, MoreHorizontal, Waypoints } from "lucide-react"
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
export type iterationCaseRow = testResultRow & { orgResults: iterationOrgResult[] }

const columnHelper = createColumnHelper<DataTableFeatures, iterationCaseRow>()

function TestCaseTitleCell({
	row,
	selected,
	indeterminate,
	onToggle,
}: {
	row: testCase;
	selected?: boolean;
	indeterminate?: boolean;
	onToggle?: (checked: boolean) => void;
}) {
	const status = TestStatusMapping[row.status as keyof typeof TestStatusMapping];
	const Icon = status?.icon || Info;

	return (
		<div className="flex flex-row justify-between items-center gap-1">
			<div className="flex flex-row items-center gap-4">
				<div className="flex flex-row gap-2">
					<div className="flex flex-row items-center gap-4">
						{
							onToggle && (
								<Checkbox
									checked={selected}
									indeterminate={indeterminate}
									onCheckedChange={(checked) => onToggle(checked === true)}
									onClick={(event) => event.stopPropagation()}
									aria-label={`Select ${row.title} for testing`}
								/>
							)
						}
						<div className="flex flex-row items-center gap-3">
							<div className="">
								<p className="text-sm">{row.title}</p>
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
}: {
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
				onToggleAll ? (
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
					/>
				)
			},
		}),
		columnHelper.accessor("preconditions", {
			header: "Preconditions",
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
			cell: (info) => {
				const value = info.getValue()
				return value ? <AudienceBadge audience={value} /> : null
			}
		}),
		columnHelper.accessor("roleAssignee", {
			header: "Role Assignee",
			cell: (info) => (
				<p className="text-xs font-medium text-muted-foreground">{info.getValue()}</p>
			)
		}),
	])
}
