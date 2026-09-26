"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { TestingSuites } from "@/lib/supabase/Init"
import { TestCase } from "../types"
import { Ban, CircleCheck, CircleX, Clipboard, ClipboardCheck, GripVertical, Info, TestTube, TestTubeDiagonal, TestTubes, TriangleAlert, Waypoints } from "lucide-react"
import { Badge } from "../ui/badge"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card"
import { testCase } from "@/lib/supabase/test-cases"
import { cn } from "@/lib/utils"
import type { suiteStatus } from "@/lib/supabase/Init"
import { useDragHandle } from "./data-table"


// export type testCaseStatus = "Untested" | "In Progress" | "Passed" | "Failed";
export const TestStatusMapping = {
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
	},
	"Blocked": {
		icon: Ban,
		variant: "secondary",
		className: "bg-gray-200 text-gray-800",
	}
} as const



const SYNC_MARKERS = {
	not_in_round: { label: "🆕 Not in round", className: "border-blue-600/40 bg-blue-50 text-blue-800" },
	changed: { label: "✏️ Changed", className: "border-amber-600/40 bg-amber-50 text-amber-800" },
	outdated: { label: "⚠️ Outdated · retest next round", className: "border-red-600/40 bg-red-50 text-red-800" },
} as const;

const columnHelper = createColumnHelper<DataTableFeatures, testCase>()

// Pulled out as a real component (not an inline `cell: (info) => {...}` arrow)
// so useDragHandle() is called from something ESLint's rules-of-hooks
// recognizes as a component — it's still rendered via flexRender's
// React.createElement, so this was always runtime-safe, just lint-unclear.
function TestCaseTitleCell({ row, suiteStatus }: { row: testCase; suiteStatus: suiteStatus }) {
	const status = TestStatusMapping[row.status as keyof typeof TestStatusMapping];
	const Icon = status?.icon || Info;
	const dragHandle = useDragHandle();
	return (
		<div className="flex flex-row justify-between items-center gap-1">
			<div className="flex flex-row items-center gap-4">
				{dragHandle ? (
					<span
						{...dragHandle.attributes}
						{...dragHandle.listeners}
						className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground"
						onClick={(e) => e.stopPropagation()}
						aria-label="Drag to reorder"
					>
						<GripVertical size={15} />
					</span>
				) : (
					<Icon data-icon="inline-start" size={15} className={`text-${row.status === "Passed" ? "green-800" : row.status === "Failed" ? "red-500" : "gray-500"}`} />
				)}
				<div className="">
					<div className="flex flex-row items-center gap-2">
						<p className="text-sm">{row.title}</p>
						{row.lifecycleStatus === "updated" && (
							<Badge variant="outline" className="text-xs">Updated</Badge>
						)}
						{/* Set by the Test Cases tab while a round runs: where this live case stands vs the round. */}
						{(() => {
							const marker = (row as testCase & { syncMarker?: keyof typeof SYNC_MARKERS }).syncMarker;
							return marker ? (
								<Badge variant="outline" className={`text-xs ${SYNC_MARKERS[marker].className}`}>{SYNC_MARKERS[marker].label}</Badge>
							) : null;
						})()}
					</div>
					<p className="text-xs text-muted-foreground">{row.code}</p>
				</div>
			</div>
		</div>
	)
}

// Before the suite leaves Draft there's no way for any case to be part of a
// round yet — the execution-status columns only carry real information from
// Ready onward (a Ready suite can already have a planned/running iteration).
export function getColumns(suiteStatus: suiteStatus, options?: { renderActions?: (row: testCase) => React.ReactNode }) {
	const renderActions = options?.renderActions;
	const showExecutionStatus = suiteStatus !== "draft";
	return columnHelper.columns([
		columnHelper.display({
			cell: (info) => <TestCaseTitleCell row={info.row.original} suiteStatus={suiteStatus} />,
			header: "Test Cases",
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
				// The readiness RPC only flags step_without_expected_result once per
				// case (distinct), so it can't say how many steps are actually broken —
				// recompute that count here from the real step data instead.
				const stepsMissingExpected = steps.filter((step) => (step.expectedResults?.length ?? 0) === 0);
				return steps.length === 0 ? (
					<div className="flex flex-row items-center gap-2">
						<p className="text-xs text-muted-foreground">No Steps</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
									<TriangleAlert size={15} className="text-amber-800" />
								</div>
							} />
							<HoverCardContent className="w-fit p-4 flex flex-col gap-3">
								<div className="flex flex-row items-start gap-2">
									<div className="bg-amber-600/5 rounded-md p-2 w-fit">
										<TriangleAlert className="text-amber-800 size-5" />
									</div>
									<div className="">
										<p className="font-semibold text-sm">Warning</p>
										<p className="text-xs">This problem may affect the test execution.</p>
									</div>
								</div>
								<div className="">
									<p className="text-xs">Problems:</p>
									<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
										<li>No steps defined for this test case</li>
									</ul>
								</div>
							</HoverCardContent>
						</HoverCard>
					</div>
				) : (
					<div className="flex flex-row items-center gap-2">
						<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
							<Waypoints size={15} className="text-gray-800" />
							<div className="flex flex-row items-center gap-0.5">
								<p className="font-mono text-xs text-gray-800">{steps.length}</p>
								<p className="text-xs text-gray-800 font-semibold">Steps</p>
							</div>
						</div>
						{stepsMissingExpected.length > 0 && (
							<HoverCard>
								<HoverCardTrigger render={
									<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
										<TriangleAlert size={15} className="text-amber-800" />
										<p className="font-mono text-xs text-amber-800">{stepsMissingExpected.length}</p>
									</div>
								} />
								<HoverCardContent className="w-fit max-w-sm p-4 flex flex-col gap-3">
									<div className="flex flex-row items-start gap-2">
										<div className="bg-amber-600/5 rounded-md p-2 w-fit">
											<TriangleAlert className="text-amber-800 size-5" />
										</div>
										<div className="">
											<p className="font-semibold text-sm">Warning</p>
											<p className="text-xs">These problems may affect the test execution.</p>
										</div>
									</div>
									<div className="">
										<p className="text-xs">{stepsMissingExpected.length} of {steps.length} step{steps.length === 1 ? "" : "s"} missing an expected result:</p>
										<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
											{stepsMissingExpected.map((step) => (
												<li key={step.id}>{step.step}</li>
											))}
										</ul>
									</div>
								</HoverCardContent>
							</HoverCard>
						)}
					</div>
				)
			}
		}),
		columnHelper.accessor("roleAssignee", {
			header: "Role Assignee",
			cell: (info) => (
				!info.getValue() ? (
					<div className="flex flex-row items-center gap-2">
						<p className="text-xs text-muted-foreground">No role assigned</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
									<TriangleAlert size={15} className="text-amber-800" />
								</div>
							} />
							<HoverCardContent className="w-fit p-4 flex flex-col gap-3">
								<div className="flex flex-row items-start gap-2">
									<div className="bg-amber-600/5 rounded-md p-2 w-fit">
										<TriangleAlert className="text-amber-800 size-5" />
									</div>
									<div className="">
										<p className="font-semibold text-sm">Warning</p>
										<p className="text-xs">This problem may affect the test execution.</p>
									</div>
								</div>
								<div className="">
									<p className="text-xs">Problems:</p>
									<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
										<li>No role assignee set for this test case</li>
									</ul>
								</div>
							</HoverCardContent>
						</HoverCard>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">{info.getValue()}</p>
				)
			)
		}),
		columnHelper.display({
			id: "readiness",
			header: "Status",
			cell: (info) => {
				const issues = (info.row.original as testCase & { readinessIssues?: string[] }).readinessIssues ?? [];
				return issues.length === 0 ? (
					<Badge variant="outline" className="text-xs border-green-600/50 bg-green-50 text-green-800">
						<CircleCheck data-icon="inline-start" size={12} />
						Ready
					</Badge>
				) : (
					<Badge variant="outline" className="text-xs border-amber-600/50 bg-amber-50 text-amber-800">
						<TriangleAlert data-icon="inline-start" size={12} />
						Not ready
					</Badge>
				);
			}
		}),
		...(showExecutionStatus ? [columnHelper.accessor("status", {
			header: "Current Testing Status",
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
		})] : []),
	])
}
