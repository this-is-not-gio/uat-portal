"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { Badge } from "../ui/badge"
import { Checkbox } from "../ui/checkbox"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card"
import { ClipboardCheck, Info, Waypoints } from "lucide-react"
import { TestStatusMapping } from "./columns"
// Type-only import: test-iterations.ts uses the server Supabase client.
import type { testResultRow } from "@/lib/supabase/test-iterations"
import { testCase } from "@/lib/supabase/test-cases"

const columnHelper = createColumnHelper<DataTableFeatures, testCase>()

const TEST_CASE_STATUS_MAPPING = {
	passed: { label: "Passed", className: "bg-green-50 text-green-800 border-green-600/40" },
	failed: { label: "Failed", className: "bg-red-50 text-red-800 border-red-600/40" },
	skipped: { label: "Skipped", className: "bg-yellow-50 text-yellow-800 border-yellow-600/40" },
} as const

function TestCaseTitleCell({
	row,
	selected,
	onToggle,
}: {
	row: testCase;
	selected?: boolean;
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
									onCheckedChange={(checked) => onToggle(checked === true)}
									onClick={(event) => event.stopPropagation()}
									aria-label={`Select ${row.title} for testing`}
								/>
							)
						}
						<div className="">
							<p className="text-sm">{row.title}</p>
							{row.lifecycleStatus === "updated" && (
								<Badge variant="outline" className="text-xs">Updated</Badge>
							)}
							<p className="text-xs text-muted-foreground">{row.code}</p>
						</div>

						{/* Set by the Test Cases tab while a round runs: where this live case stands vs the round. */}
					</div>
				</div>
			</div>
		</div>
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
	onToggle?: (id: string, checked: boolean) => void;
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
			cell: (info) => (
				<TestCaseTitleCell
					row={info.row.original}
					selected={selectedIds?.has(info.row.original.id)}
					onToggle={onToggle ? (checked) => onToggle(info.row.original.id, checked) : undefined}
				/>
			),
		}),
		columnHelper.accessor("preconditions", {
			header: "Preconditions",
			cell: (info) => (
				info.getValue()?.length === 0 ? (
					<div className="flex flex-row items-center gap-2">
						<p className="text-xs text-muted-foreground">No Preconditions</p>
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
				) : (
					<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
						<ClipboardCheck size={15} className="text-gray-800" />
						<div className="flex flex-row items-center gap-0.5">
							<p className="font-mono text-xs text-gray-800">{info.getValue()?.length}</p>
							<p className="text-xs text-gray-800 font-semibold">Preconditions</p>
						</div>
					</div>
				)
			)
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
		columnHelper.accessor("roleAssignee", {
			header: "Role Assignee",
			cell: (info) => (
				<p className="text-xs font-medium text-muted-foreground">{info.getValue()}</p>
			)
		}),
		columnHelper.display({
			id: "status",
			header: "Status",
			cell: (info) => {
				const status = TEST_CASE_STATUS_MAPPING[info.row.original.status as keyof typeof TEST_CASE_STATUS_MAPPING];
				return (
					<Badge className={`text-xs ${status?.className || ""}`} variant="outline">
						Up to Date
					</Badge>
				)
			}
		}),
	])
}
