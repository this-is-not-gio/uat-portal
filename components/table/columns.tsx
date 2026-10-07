"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { TestingSuites } from "@/lib/supabase/Init"
import { TestCase } from "../types"
import { Ban, CircleCheck, CircleX, Clipboard, ClipboardCheck, ClipboardX, GitBranchPlus, GitCompare, GitPullRequest, GripVertical, Info, LucideIcon, Scissors, Stars, TestTube, TestTubeDiagonal, TestTubes, TriangleAlert, Waypoints } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card"
import { testCase } from "@/lib/supabase/test-cases"
import { cn } from "@/lib/utils"
import type { suiteStatus } from "@/lib/supabase/Init"
import { useDragHandle } from "./data-table"
import { AudienceBadge } from "../audience-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { caseResultLabel, shortRoundName, type caseFlag, type caseState } from "@/lib/supabase/case-states"


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

const TestCaseStatusBadge: Record<caseState["status"], { label: string; className: string, icon: LucideIcon }> = {
	"in_testing": { label: "In Testing", className: "bg-gray-100 text-gray-800 border-gray-600/40", icon: TestTubeDiagonal },
	"for_testing": { label: "For Testing", className: "bg-purple-50 text-purple-800 border-purple-600/40", icon: TestTube },
	"not_ready": { label: "Not Ready", className: "bg-amber-50 text-amber-800 border-amber-600/40", icon: TriangleAlert },
	"tested": { label: "Tested", className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: ClipboardCheck },
	"ready": { label: "Ready", className: "bg-green-50 text-green-800 border-green-600/40", icon: Clipboard },
}
const TestCaseFlags: Record<caseFlag, { label: string; className: string; icon: typeof Stars }> = {
	"incomplete": { label: "Incomplete", className: "bg-amber-50 text-amber-800 border-amber-600/40", icon: TriangleAlert },
	"changed_after_testing": { label: "Changed After Testing", className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitPullRequest },
	"update_pending": { label: "Update Pending", className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitCompare },
	"skipped": { label: "Skipped", className: "bg-gray-50 text-gray-800 border-gray-600/40", icon: Scissors },
	"changed_since": { label: "Changed Since Last Test", className: "bg-blue-50 text-blue-800 border-blue-600/40", icon: GitBranchPlus },
	"not_tested": { label: "Not Tested Yet", className: "bg-gray-50 text-gray-800 border-gray-600/40", icon: TestTubes },
}

const columnHelper = createColumnHelper<DataTableFeatures, testCase>()

// Pulled out as a real component (not an inline `cell: (info) => {...}` arrow)
// so useDragHandle() is called from something ESLint's rules-of-hooks
// recognizes as a component — it's still rendered via flexRender's
// React.createElement, so this was always runtime-safe, just lint-unclear.
function TestCaseTitleCell({ row }: { row: testCase; suiteStatus: suiteStatus }) {
	const dragHandle = useDragHandle();
	return (
		<div className="flex flex-row justify-between items-center gap-1">
			<div className="">
				<p className="text-xs">{row.title}</p>
				<p className="font-mono text-xs text-muted-foreground">
					{row.code}
					{/* Below md the status column is hidden, so status and top flag ride along as text. */}
					{row.caseState && (
						<span className="md:hidden">
							{`·${TestCaseStatusBadge[row.caseState.status].label}`}
							{row.caseState.flags[0] && `·${flagText(row.caseState.flags[0], row.caseState)}`}
						</span>
					)}
				</p>
			</div>
		</div>
	)
}

// Flag text with the round it refers to, e.g. "Skipped · UAT 01".
function flagText(flag: caseFlag, state: caseState) {
	const label = TestCaseFlags[flag].label;
	if (flag === "skipped" || flag === "changed_since") return `${label} · ${shortRoundName(state.resultRoundName)}`;
	return label;
}

// Status badge plus the top flag as an icon; the tooltip lists every flag (flags[0] is the highest priority).
function CaseStatusCell({ state }: { state?: caseState }) {
	if (!state) return null;
	const status = TestCaseStatusBadge[state.status];
	const topFlag = state.flags[0];
	const flag = topFlag ? TestCaseFlags[topFlag] : undefined;
	const FlagIcon = flag?.icon;
	return (
		<div className="flex flex-row items-center justify-end gap-2">
			{flag && FlagIcon && (
				<Tooltip>
					<TooltipTrigger render={
						<div className={cn("w-fit p-1 rounded-md flex flex-row items-center gap-1", flag.className)} aria-label={flagText(topFlag, state)}>
							<FlagIcon size={15} />
						</div>
					} />
					<TooltipContent className="flex flex-col items-start gap-0.5">
						{state.flags.map((f, index) => (
							<p key={f} className={index === 0 ? "font-semibold" : undefined}>{flagText(f, state)}</p>
						))}
					</TooltipContent>
				</Tooltip>
			)}
			<div className={cn("rounded-md py-1 px-1.5 w-fit flex flex-row items-center gap-1", status.className)}>
				<status.icon size={12} />
				<p className="text-xs font-semibold">{status.label}</p>
			</div>
		</div>
	)
}

// Result rolled up across orgs; hover shows each org's result in that round.
function CaseResultCell({ state }: { state?: caseState }) {
	if (!state?.result) return <p className="text-xs text-muted-foreground">—</p>;
	const style = TestStatusMapping[state.result === "In progress" ? "In Progress" : state.result];
	const Icon = style.icon;
	return (
		<HoverCard>
			<HoverCardTrigger render={
				<div className={cn("rounded-md py-1 px-1.5 w-fit flex flex-row items-center gap-1.5", style.className)}>
					<Icon size={12} />
					<p className="text-xs font-semibold">{caseResultLabel(state)}</p>
				</div>
			} />
			<HoverCardContent className="w-fit p-3 flex flex-col gap-1.5">
				<p className="text-xs font-semibold">{state.resultRoundName}</p>
				{state.perOrg.map((org) => (
					<div key={org.organizationId} className="flex flex-row items-center justify-between gap-4">
						<p className="text-xs">{org.organizationName}</p>
						<p className="text-xs text-muted-foreground">{org.result}{org.changed ? " · changed since" : ""}</p>
					</div>
				))}
			</HoverCardContent>
		</HoverCard>
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
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => (
				info.getValue()?.length === 0 ? (
					<div className="flex flex-row items-center gap-2 justify-between">
						<p className="font-mono text-xs text-muted-foreground">—</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1 rounded-md p-1 bg-blue-600/5 w-fit">
									<Info size={15} className="text-blue-800"/>
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
						</div>
					</div>
				)
			)
		}),
		columnHelper.accessor("stepsToExecute", {
			header: "Steps to Execute",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => {
				const steps = info.getValue() ?? [];
				// The readiness RPC only flags step_without_expected_result once per
				// case (distinct), so it can't say how many steps are actually broken —
				// recompute that count here from the real step data instead.
				const stepsMissingExpected = steps.filter((step) => (step.expectedResults?.length ?? 0) === 0);
				return steps.length === 0 ? (
					<div className="flex flex-row items-center gap-2 justify-between">
						<p className="font-mono text-xs text-muted-foreground">—</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1.5 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
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
								<p className="text-xs  text-gray-800 font-semibold">Steps</p>
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
			meta: { className: "hidden lg:table-cell" },
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
		columnHelper.accessor("audience", {
			header: "Audience",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => {
				const value = info.getValue();
				return value ? <AudienceBadge audience={value} /> : null;
			}
		}),
		columnHelper.display({
			id: "status",
			meta: { className: "hidden md:table-cell" },
			cell: (info) => <CaseStatusCell state={info.row.original.caseState} />,
		}),
	])
}
