"use client";

import { Ban, CalendarClock, CircleCheck, CircleDashed, CircleDot, CircleX, Clipboard, FileClock, FileUpIcon, FolderClock, History, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import { testResultColumns } from "@/components/table/test-result-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import { isRemovedFromRound } from "@/lib/supabase/case-states";
import { cn, formatIterationTimestamp } from "@/lib/utils";
import { format, isBefore, parseISO, startOfToday } from "date-fns";
import IterationActions from "@/components/testsuite-layout/shared/iteration-actions";
import type { organization } from "@/lib/supabase/organizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";
import { TestCasesSidebarTrigger } from "../test-cases/test-cases-sidebar";
// import { SelectTrigger } from "@base-ui/react";


function SummaryCard({ label, count, icon, iconClassName }: { label: string; count: number; icon: React.ReactNode; iconClassName?: string }) {
	return (
		<div className="flex flex-row items-center gap-2 border p-3 md:p-4 rounded-md w-full bg-gray-50/10">
			<div className={`size-10 md:size-12 shrink-0 border rounded-md flex flex-row items-center justify-center ${iconClassName ?? "bg-gray-50/50"}`}>
				{icon}
			</div>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<div className="flex flex-row items-end gap-1">
					<p className="font-mono font-semibold text-xl">{count}</p>
					<p className="text-xs text-muted-foreground">Test Cases</p>
				</div>
			</div>
		</div>
	);
}

// The viewed org's part of the round: testing, submitted, or pulled back after submitting.
// "not_submitted" is a finished round the org never submitted.
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
	participantOrgs = [],
	selectedOrgId = null,
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
	// The round's participants; picking one sets ?org= and the server tab refetches its rows.
	participantOrgs?: organization[];
	selectedOrgId?: string | null;
	// null for a planned round (nothing to report yet).
	participationStatus?: participationStatus | null;
	// Vendor only, while the round runs: edits to tested cases waiting for Sync (server tab renders it).
	syncBanner?: React.ReactNode;
	// Create New Iteration / Issue Sign-off, each only when allowed (server tab renders them).
	headerActions?: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const selectedOrg = participantOrgs.find((org) => org.id === selectedOrgId) ?? null;

	function pickParticipant(id: string | null) {
		if (!id || id === selectedOrgId) return;
		const params = new URLSearchParams(searchParams.toString());
		params.set("org", id);
		router.push(`${pathname}?${params.toString()}`);
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
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
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
			{/* {submission} */}
			{/* {participation} */}
			<div className="flex flex-col gap-1 font-semibold">
				<div className="">
					<p className="text-xs">Overview</p>
				</div>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
					<SummaryCard label="Total Test Cases" count={testResultRows.length} icon={<Clipboard />} />
					<SummaryCard label="Passed Test Cases" count={passed} icon={<CircleCheck className="text-green-800" />} iconClassName="bg-green-50/50 border-green-800" />
					<SummaryCard label="Failed Test Cases" count={failed} icon={<CircleX className="text-red-800" />} iconClassName="bg-red-50/50 border-red-800" />
					<SummaryCard label="Blocked Test Cases" count={blocked} icon={<Ban className="text-gray-800" />} />
					{/* <SummaryCard label="Not Yet Tested" count={notTested} icon={<CircleDashed />} /> */}
				</div>
			</div>
			{/* {(hasPreviousRound || hasMidRoundChanges) && (
					<div className="flex flex-row items-center gap-2">
						{hasPreviousRound && (
							<Button
								size="sm"
								variant={onlyFailedLastRound ? "default" : "outline"}
								onClick={() => setOnlyFailedLastRound((current) => !current)}
							>
								<History className="h-3.5 w-3.5" />
								<p className="text-xs">Failed / Blocked last round</p>
							</Button>
						)}
						{hasMidRoundChanges && (
							<Button
								size="sm"
								variant={onlyChangedMidRound ? "default" : "outline"}
								onClick={() => setOnlyChangedMidRound((current) => !current)}
							>
								<RefreshCw className="h-3.5 w-3.5" />
								<p className="text-xs">Changed mid-round</p>
							</Button>
						)}
					</div>
				)} */}
			{syncBanner}
			<div className="min-h-0 flex-1 flex flex-col gap-2">
				<div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
					{/* <p className="text-xs">{`${selectedOrg?.name ?? "Organization"}'s Test Results`}</p> */}
					<Select value={selectedOrgId} onValueChange={pickParticipant} disabled={participantOrgs.length < 2}>
						<SelectTrigger className="w-full min-w-0 md:w-50">
							<SelectValue>
								<p className="text-xs font-medium">{selectedOrg ? `${selectedOrg.name} - ${ORG_TYPE_LABELS[selectedOrg.type]}` : "No participants"}</p>
							</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							{participantOrgs.map((org) => (
								<SelectItem key={org.id} value={org.id}>
									<div className="flex flex-col">
										<p className="text-xs">{org.name}</p>
										<p className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</p>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{participationStatus && <ParticipationBadge status={participationStatus} />}
				</div>
				<DataTable
					columns={testResultColumns}
					data={visibleRows}
					// Removed from the suite: its results stay in this round, but there's nothing left to execute.
					isRowDisabled={(row) => row.pendingChange === "removed" || isRemovedFromRound(row)}
					// Result writes don't revalidate and the root layout doesn't re-render on
					// navigation, so refresh once on close to keep the sidebar's "N left" current.
					onDetailClose={() => router.refresh()}
					renderRowDetail={(row) => (
						<TestCaseSheet
							testCase={row}
							mode={isRunning && !isLocked ? "execute" : "review"}
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
