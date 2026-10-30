"use client";

import { Ban, CalendarClock, ChartNoAxesCombined, CircleCheck, CircleDashed, CircleDot, CircleX, Clipboard, FileClock, FileUpIcon, FolderClock, History, RefreshCw, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import { testResultColumns, testResultOverallColumns } from "@/components/table/test-result-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import { isRemovedFromRound } from "@/lib/supabase/case-states";
import { cn, formatIterationTimestamp, formatTimestamp, humanizeTimestamp, initials } from "@/lib/utils";
import { BADGE_VARIANTS } from "@/components/sidebar/app-sidebar";
import { format, isBefore, parseISO, startOfToday } from "date-fns";
import IterationActions from "@/components/testsuite-layout/shared/iteration-actions";
import type { organization } from "@/lib/supabase/organizations";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";
import { TestCasesSidebarTrigger } from "../test-cases/test-cases-sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryCard } from "@/components/testsuite-layout/shared/summary-card";


// The viewed org's part of the round: testing, submitted, or pulled back after submitting.
// "not_submitted" is a finished round the org never submitted.
// Testers who submitted this round, grouped by org: what the Submitted Test Results picker lists.
export type submittedGroup = {
	organization: organization;
	testers: { userId: string; fullName: string | null; roleName: string; submittedAt: string }[];
};

export type participationStatus = { kind: "in_progress" | "submitted" | "withdrawn" | "not_submitted"; at: string | null };

const PARTICIPATION_BADGES: Record<participationStatus["kind"], { label: string; Icon: typeof CircleDot; className: string; prefix: string }> = {
	in_progress: { label: "In Progress", Icon: CircleDot, className: "border-blue-600/40 bg-blue-50 text-blue-800", prefix: "" },
	submitted: { label: "Submitted", Icon: CircleCheck, className: "border-green-800/30 bg-green-50 text-green-800", prefix: "Submitted on " },
	withdrawn: { label: "Withdrawn", Icon: Undo2, className: "border-amber-600/40 bg-amber-50 text-amber-800", prefix: "Withdrawn on " },
	not_submitted: { label: "Not Submitted", Icon: CircleDashed, className: "text-muted-foreground", prefix: "" },
};

function ParticipationBadge({ status }: { status: participationStatus }) {
	const { label, Icon, className, prefix } = PARTICIPATION_BADGES[status.kind];
	return (
		<div className="flex flex-row items-center justify-between gap-2 w-full md:w-fit md:justify-start">

			{
				status.kind === "not_submitted" || status.kind === "in_progress" ? null : (
					<p className="text-xs text-muted-foreground">{label} on {status.at ? format(parseISO(status.at), "MMM d yyyy, h:mm a") : "N/A"}</p>
				)
			}
			<Badge
				variant="outline"
				className={cn("text-xs", className)}
				title={status.at && prefix ? `${prefix}${format(parseISO(status.at), "MMM d yyyy, h:mm a")}` : undefined}
			>
				<Icon data-icon="inline-start" />
				{label}
			</Badge>
			<Button className="text-xs" variant="outline" onClick={() => { }}>
				<FileUpIcon size={15} />
				Export Result
			</Button>
		</div>
	);
}

function hasResults(row: testResultRow): boolean {
	return row.status !== "Untested" || (row.stepsToExecute ?? []).some((step) => step.status !== "Untested" || (step.remarks?.length ?? 0) > 0);
}

export default function TestResultsComponents({
	iteration,
	testSuiteSlug,
	sectionName,
	results,
	iterationHasResults,
	isLocked = false,
	canRemark = false,
	unsubmittedOrgs = [],
	participation,
	submission,
	view = "overall",
	submittedGroups = [],
	selectedTesterId = null,
	participationStatus = null,
	syncBanner = null,
	headerActions = null,
}: {
	iteration: testIteration;
	testSuiteSlug: string;
	sectionName: string;
	results: testResultRow[];
	// Across the whole iteration, not just the visible section (decides whether Cancel/Reset warns about erasing).
	iterationHasResults: boolean;
	// The org being viewed submitted this round, so its rows open read-only (Phase 6).
	isLocked?: boolean;
	// Remarks stay open after submitting and after the round ends (0020).
	canRemark?: boolean;
	// External orgs that haven't submitted; the Complete dialog warns about them.
	unsubmittedOrgs?: organization[];
	// Participation panel (Admin/Internal) and Submit bar (External), rendered by the server tab.
	participation?: React.ReactNode;
	submission?: React.ReactNode;
	// Overall: the whole round, every org. Submitted: one submitted tester's results, picked from
	// submittedGroups; both live in the URL (?view=, ?tester=&org=) so the server tab refetches.
	view?: "overall" | "submitted";
	submittedGroups?: submittedGroup[];
	selectedTesterId?: string | null;
	// null for a planned round (nothing to report yet).
	participationStatus?: participationStatus | null;
	// Vendor only, while the round runs: edits to tested cases waiting for Sync (server tab renders it).
	syncBanner?: React.ReactNode;
	// Create New Iteration / Issue Sign-off, each only when allowed (server tab renders them).
	headerActions?: React.ReactNode;
}) {
	const currentUser = useCurrentUser();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const selectedGroup = submittedGroups.find((group) => group.testers.some((t) => t.userId === selectedTesterId)) ?? null;
	const selectedTester = selectedGroup?.testers.find((t) => t.userId === selectedTesterId) ?? null;

	function pushParams(update: (params: URLSearchParams) => void) {
		const params = new URLSearchParams(searchParams.toString());
		update(params);
		router.push(`${pathname}?${params.toString()}`);
	}
	function pickView(next: string | number | null) {
		if (next !== "overall" && next !== "submitted") return;
		if (next === view) return;
		pushParams((params) => params.set("view", next));
	}
	function pickTester(userId: string | null) {
		const group = submittedGroups.find((g) => g.testers.some((t) => t.userId === userId));
		if (!userId || !group || userId === selectedTesterId) return;
		pushParams((params) => {
			params.set("view", "submitted");
			params.set("org", group.organization.id);
			params.set("tester", userId);
		});
	}
	const [testResultRows, setTestResultRows] = useState<testResultRow[]>(results);
	const [onlyFailedLastRound, setOnlyFailedLastRound] = useState(false);
	const [onlyChangedMidRound, setOnlyChangedMidRound] = useState(false);

	const isRunning = iteration.status === "in_progress";
	const isOpen = isRunning || iteration.status === "not_started";
	// Rows removed mid-round (0036) are listed but out of the run, so out of the scorecards.
	const inRunRows = testResultRows.filter((row) => !isRemovedFromRound(row));
	const passed = inRunRows.filter((row) => row.status === "Passed").length;
	const failed = inRunRows.filter((row) => row.status === "Failed").length;
	const blocked = inRunRows.filter((row) => row.status === "Blocked").length;
	const notTested = inRunRows.length - passed - failed - blocked;

	const hasPreviousRound = testResultRows.some((row) => row.previousStatus !== null);
	const isChangedMidRound = (row: testResultRow) => row.syncKind !== null || row.pendingChange !== undefined;
	const hasMidRoundChanges = testResultRows.some(isChangedMidRound);
	const visibleRows = testResultRows
		.filter((row) => !onlyFailedLastRound || row.previousStatus === "Failed" || row.previousStatus === "Blocked")
		.filter((row) => !onlyChangedMidRound || isChangedMidRound(row));

	const isOverdue = isRunning && !!iteration.plannedEndDate && isBefore(parseISO(iteration.plannedEndDate), startOfToday());

	return (
		<div className="flex-1 min-w-0 p-4 flex flex-col gap-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 border bg-gray-100/50 p-4 rounded-md">
				<div className="flex flex-row gap-3 items-center">
					<TestCasesSidebarTrigger />
					<FolderClock size={30} className="hidden lg:block" />
					<div className="flex flex-col">
						<p className="font-semibold text-xs">{iteration.name} Results</p>
						<p className="font-mono text-xs text-muted-foreground">{iteration.startedAt ? format(parseISO(iteration.startedAt), "MMM d yyyy") : "Not started"} to {iteration.plannedEndDate ? format(parseISO(iteration.plannedEndDate), "MMM d yyyy") : "no end date"}</p>
					</div>
				</div>
				{headerActions}
			</div>
			{syncBanner}
			<div className="flex flex-col gap-4 font-semibold">
				<div className="flex flex-row justify-between items-center gap-2">
					<Tabs value={view} onValueChange={pickView}>
						<TabsList>
							<TabsTrigger value="overall" className="text-xs">
								<ChartNoAxesCombined />
								Overall Iteration Results
							</TabsTrigger>
							<TabsTrigger value="submitted" className="text-xs">
								<Send />
								Submitted Test Results
							</TabsTrigger>
						</TabsList>
					</Tabs>
					{view === "submitted" && (
						<Select value={selectedTesterId} onValueChange={pickTester} disabled={submittedGroups.length === 0}>
							<SelectTrigger className="w-full min-w-0 md:w-64">
								<SelectValue>
									<p className="text-xs font-medium">
										{selectedTester && selectedGroup ? `${selectedTester.fullName ?? "Unnamed tester"}` : "No submitted results"}
									</p>
								</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								{submittedGroups.map((group) => (
									<SelectGroup key={group.organization.id}>
										<SelectLabel>{group.organization.name}</SelectLabel>
										{group.testers.map((tester) => (
											<SelectItem key={tester.userId} value={tester.userId}>
												<div className="flex flex-col">
													<p className="text-xs">{tester.fullName ?? "Unnamed tester"}</p>
													<p className="text-xs text-muted-foreground">{tester.roleName}</p>
												</div>
											</SelectItem>
										))}
									</SelectGroup>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				{
					view === "submitted" && selectedTester && (
						<div className="flex flex-row items-center justify-between gap-4">
							<div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
								<p>Showing results submitted by:</p>
								<div className="flex flex-row items-center gap-2">
									<div className={cn("size-10 shrink-0 rounded-full flex items-center justify-center", (BADGE_VARIANTS[selectedGroup?.organization.type as keyof typeof BADGE_VARIANTS] ?? BADGE_VARIANTS.fallback).UserClassName)}>
										<p className="text-sm font-bold text-white">{initials(selectedTester.fullName ?? "?")}</p>
									</div>
									<div className="flex flex-col">
										<p className="text-xs font-medium text-foreground">{selectedTester.fullName ?? "Unnamed tester"}</p>
										<p className="text-xs text-muted-foreground">{selectedGroup?.organization.name} - {selectedTester.roleName}</p>
									</div>
								</div>
							</div>
							<div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
								<p>Submitted on</p>
								<p className="text-xs font-medium text-foreground" title={formatTimestamp(selectedTester.submittedAt)}>{humanizeTimestamp(selectedTester.submittedAt)}</p>
							</div>
						</div>
					)
				}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
					<SummaryCard label="Total Test Cases" count={testResultRows.length} unit="Test Cases" icon={<Clipboard />} />
					<SummaryCard label="Passed Test Cases" count={passed} unit="Test Cases" icon={<CircleCheck className="text-green-800" />} iconClassName="bg-green-50/50 border-green-800" />
					<SummaryCard label="Failed Test Cases" count={failed} unit="Test Cases" icon={<CircleX className="text-red-800" />} iconClassName="bg-red-50/50 border-red-800" />
					<SummaryCard label="Blocked Test Cases" count={blocked} unit="Test Cases" icon={<Ban className="text-gray-800" />} />
					{/* <SummaryCard label="Not Yet Tested" count={notTested} icon={<CircleDashed />} /> */}
				</div>
				<DataTable
						columns={view === "overall" ? testResultOverallColumns : testResultColumns}
						data={visibleRows}
						// Removed from the suite: its results stay in this round, but there's nothing left to execute.
						isRowDisabled={(row) => row.pendingChange === "removed" || isRemovedFromRound(row)}
						// Result writes don't revalidate and the root layout doesn't re-render on
						// navigation, so refresh once on close to keep the sidebar's "N left" current.
						onDetailClose={() => router.refresh()}
						renderRowDetail={(row) => (
							<TestCaseSheet
								testCase={row}
								// A row is a roll-up of several testers' copies: only its own tester records on it.
								mode={isRunning && !isLocked && !!currentUser && row.testerId === currentUser.id ? "execute" : "review"}
								canRemark={canRemark}
								onChangeTestCase={(updated) => {
									setTestResultRows((current) => current.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
								}}
							/>
						)}
					/>
			</div>

		</div>
	)
}
