"use client";

import { Ban, CalendarClock, CircleCheck, CircleDashed, CircleX, Clipboard, FileUpIcon, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import { testResultColumns } from "@/components/table/test-result-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { useState } from "react";
import type { testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import { cn, formatIterationTimestamp } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isBefore, parseISO, startOfToday } from "date-fns";
import IterationActions from "./components/iteration-actions";


function SummaryCard({ label, count, icon, iconClassName }: { label: string; count: number; icon: React.ReactNode; iconClassName?: string }) {
	return (
		<div className="flex flex-row items-center gap-2 border p-4 rounded-md w-full bg-gray-50/10">
			<div className={`size-12 border rounded-md flex flex-row items-center justify-center ${iconClassName ?? "bg-gray-50/50"}`}>
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

function hasResults(row: testResultRow): boolean {
	return row.status !== "Untested" || (row.stepsToExecute ?? []).some((step) => step.status !== "Untested" || (step.remarks?.length ?? 0) > 0);
}

export default function TestResultComponents({
	iteration,
	testSuiteSlug,
	sectionName,
	results,
	iterationHasResults,
}: {
	iteration: testIteration;
	testSuiteSlug: string;
	sectionName: string;
	results: testResultRow[];
	// Across the whole iteration, not just the visible section (decides whether Cancel is offered).
	iterationHasResults: boolean;
}) {
	const [testResultRows, setTestResultRows] = useState<testResultRow[]>(results);
	const [onlyFailedLastRound, setOnlyFailedLastRound] = useState(false);
	const [onlyChangedMidRound, setOnlyChangedMidRound] = useState(false);

	const isRunning = iteration.status === "in_progress";
	const passed = testResultRows.filter((row) => row.status === "Passed").length;
	const failed = testResultRows.filter((row) => row.status === "Failed").length;
	const blocked = testResultRows.filter((row) => row.status === "Blocked").length;
	const notTested = testResultRows.length - passed - failed - blocked;

	const hasPreviousRound = testResultRows.some((row) => row.previousStatus !== null);
	const isChangedMidRound = (row: testResultRow) => row.syncKind !== null || row.pendingChange !== undefined;
	const hasMidRoundChanges = testResultRows.some(isChangedMidRound);
	const visibleRows = testResultRows
		.filter((row) => !onlyFailedLastRound || row.previousStatus === "Failed" || row.previousStatus === "Blocked")
		.filter((row) => !onlyChangedMidRound || isChangedMidRound(row));

	const isOverdue = isRunning && !!iteration.plannedEndDate && isBefore(parseISO(iteration.plannedEndDate), startOfToday());

	return (
		<ScrollArea className="flex-1 shrink-0 border-r flex flex-col px-2">
			<div className="flex-1 p-4 flex flex-col gap-4">
				<div className="flex flex-row items-center justify-between gap-4">
					<div className="flex flex-row items-center gap-2">
						<div>
							<p className="text-xs text-muted-foreground">Test Result</p>
							<div className="">
								<div className="flex flex-row items-center gap-2">
									<p className="font-semibold">{iteration.name}</p>
									{iteration.label && <p className="text-muted-foreground">· {iteration.label}</p>}
									{isRunning && (
										<Badge variant="secondary" className="text-xs bg-blue-600/20">In Progress</Badge>
									)}
								</div>
								<div className="flex flex-row items-center gap-2">
									<p className="text-xs text-muted-foreground font-mono">{sectionName} · {formatIterationTimestamp(iteration)}</p>
									{iteration.plannedEndDate && (
										<p className={cn("text-xs font-mono flex flex-row items-center gap-1", isOverdue ? "text-red-700" : "text-muted-foreground")}>
											<CalendarClock className="size-3" />
											{isOverdue ? "Overdue · " : "Planned end "}{format(parseISO(iteration.plannedEndDate), "MMM d yyyy")}
										</p>
									)}
								</div>
							</div>
						</div>
					</div>
					<div className="flex flex-row items-center gap-2">
						{isRunning && (
							<IterationActions
								iteration={iteration}
								testSuiteSlug={testSuiteSlug}
								untestedCount={testResultRows.filter((row) => row.status === "Untested" || row.status === "In Progress").length}
								hasRecordedResults={iterationHasResults || testResultRows.some(hasResults)}
							/>
						)}
						<Button className="" size="lg" variant={isRunning ? "outline" : "default"}>
							<FileUpIcon/>
							<p className="text-xs">Export Test Results</p>
						</Button>
					</div>
				</div>
				<div className="flex flex-row items-center justify-between gap-2">
					<SummaryCard label="Total Test Cases" count={testResultRows.length} icon={<Clipboard />} />
					<SummaryCard label="Passed Test Cases" count={passed} icon={<CircleCheck className="text-green-800" />} iconClassName="bg-green-50/50 border-green-800" />
					<SummaryCard label="Failed Test Cases" count={failed} icon={<CircleX className="text-red-800" />} iconClassName="bg-red-50/50 border-red-800" />
					<SummaryCard label="Blocked Test Cases" count={blocked} icon={<Ban className="text-gray-800" />} />
					<SummaryCard label="Not Yet Tested" count={notTested} icon={<CircleDashed />} />
				</div>
				{(hasPreviousRound || hasMidRoundChanges) && (
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
				)}
				<div className="min-h-0 flex-1">
					<DataTable
						columns={testResultColumns}
						data={visibleRows}
						renderRowDetail={(row) => (
							<TestCaseSheet
								testCase={row}
								mode={isRunning ? "execute" : "review"}
								onChangeTestCase={(updated) => {
									setTestResultRows((current) => current.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
								}}
							/>
						)}
					/>
				</div>
			</div>
		</ScrollArea>
	)
}
