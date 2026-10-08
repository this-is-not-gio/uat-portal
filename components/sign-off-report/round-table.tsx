"use client";

import { Ban, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { statusCounts } from "@/lib/supabase/overview";
import type { RoundParticipant, RoundSummary } from "@/lib/supabase/sign-off-report";
import { cn, formatTimestamp } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Badge } from "../ui/badge";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTableFeatures } from "../table/data-table-features";
import { DataTable } from "../table/data-table";

// One chip per status for a round's counts; in-progress counts as not tested.
const chipsFor = (counts: statusCounts) => [
	{ label: "Passed", value: counts.passed, icon: CircleCheck, className: "text-green-800 bg-green-500/10" },
	{ label: "Failed", value: counts.failed, icon: CircleX, className: "text-red-800 bg-red-500/10" },
	{ label: "Blocked", value: counts.blocked, icon: Ban, className: "text-gray-800 bg-gray-500/10" },
	{ label: "Not tested", value: counts.untested + counts.inProgress, icon: CircleDashed, className: "text-muted-foreground bg-stone-500/10" },
];

function StatusChips({ counts, className }: { counts: statusCounts; className?: string }) {
	return (
		<div className={cn("flex flex-row flex-wrap gap-1 justify-end", className)}>
			{chipsFor(counts).map(({ label, value, icon: Icon, className }) => (
				<Tooltip key={label}>
					<TooltipTrigger
						render={
							<div title={label} className={cn("flex flex-row items-center gap-1 py-1 px-2 text-xs font-semibold rounded-md", className)}>
								<Icon className="size-4" />
								<p className="font-mono">{value}</p>
							</div>
						}
					/>
					<TooltipContent>
						<p>{label}</p>
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}

const headClass = "bg-gray-50 text-xs first:pl-4 last:pr-4 last:text-right";
const cellClass = "first:pl-4 last:pr-4 text-sm last:text-right";

// Each completed round, followed by a table of its participating orgs and their own results.
// Plain Table rather than DataTable: a round and its participants stay together (also when printed).
// Below sm the table is swapped for stacked cards; print always uses the table.
export function RoundTable({ rounds }: { rounds: RoundSummary[] }) {
	return (
		<>
			<RoundCards rounds={rounds} />
		</>
	);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A one-to-two sentence read of the round: how it went, then who submitted.
// Counts are one entry per case per org, so they're "results", not test cases.
function summarizeRound(round: RoundSummary) {
	const { total, passed, failed, blocked, untested, inProgress } = round.counts;
	if (total === 0) return "No results were recorded in this iteration.";
	const notTested = untested + inProgress;
	const passRate = Math.round((passed / total) * 1000) / 10;
	const issues = [
		failed && `${failed} failed`,
		blocked && `${blocked} blocked`,
		notTested && `${notTested} not tested`,
	].filter(Boolean);
	const outcome = `${passed} of ${plural(total, "result")} passed (${passRate}%)${issues.length ? `; ${issues.join(", ")}` : ", with nothing failed, blocked or left untested"}.`;

	// Reports frozen before participants were recorded per round don't have them.
	const expected = round.participants?.filter((p) => !p.withdrawnAt) ?? [];
	if (expected.length === 0) return outcome;
	const missing = expected.filter((p) => !p.submittedAt).map((p) => p.organizationName);
	const submissions = missing.length === 0
		? `${expected.length === 1 ? "The participating organization" : `All ${expected.length} organizations`} submitted.`
		: `${expected.length - missing.length} of ${expected.length} organizations submitted; ${missing.join(", ")} did not.`;
	return `${outcome} ${submissions}`;
}

function RoundCards({ rounds }: { rounds: RoundSummary[] }) {
	return (
		<div className="flex flex-col gap-6">
			{
				rounds.map((round) => (
					<div key={round.iterationId} className="flex flex-col gap-2 print:hidden">
						<div className="flex flex-col border rounded-md">
							<div className="p-4 bg-gray-100/10 flex flex-col md:flex-row md:justify-between gap-2 border-b">
								<div className="flex flex-col gap-1 justify-center">
									<div className="flex flex-row gap-2">
										<p className="min-w-0 break-words text-sm font-semibold">{round.name}</p>
										<Badge variant="secondary" className="text-xs">{round.caseCount ?? "—"} Test Cases</Badge>
									</div>
									<p className="text-xs text-muted-foreground font-mono">
										{formatTimestamp(round.startedAt)}  to {formatTimestamp(round.completedAt)}
									</p>
								</div>
								<div className="flex-shrink-0 flex flex-row gap-4">
									<div className="flex flex-col gap-2 md:items-end">
										<p className="text-xs text-muted-foreground">Iteration Summary</p>
										<StatusChips counts={round.counts} className="justify-start" />
									</div>
								</div>
							</div>
							{/* Reports frozen before participants were recorded per round don't have them. */}
							{round.participants && round.participants.length > 0 && (
								<RoundParticipantsTable participants={round.participants} />
							)}
						</div>
						<p className="text-xs px-1">{summarizeRound(round)}</p>
					</div>
				))
			}

		</div>
	)
}

// One row per participating org in the round: name, when it submitted, and its own results.
// shadcn Table; it scrolls sideways on narrow screens rather than squeezing the chips.
function RoundParticipantsTable({ participants }: { participants: RoundParticipant[] }) {
	type ParticipantRow = RoundParticipant & { id: string };
	const columnHelper = createColumnHelper<DataTableFeatures, ParticipantRow>();
	const columns = columnHelper.columns([
		columnHelper.accessor("organizationName", {
			header: "Participating Organization",
			cell: (info) => <p className="text-xs font-semibold">{info.getValue()}</p>
		}),
		columnHelper.accessor("submittedAt", {
			header: "Date of Submission",
			cell: (info) => <SubmissionText participant={info.row.original} />
		}),
		columnHelper.accessor("counts", {
			header: "Testing Summary",
			cell: (info) => <div className="flex flex-row justify-end">
				<StatusChips counts={info.getValue()} className="justify-start" />
			</div>
		}),
	]);

	return (
		<DataTable columns={columns} data={participants.map((p) => ({ ...p, id: p.organizationName }))} bordered={false} />
	);
}

function SubmissionText({ participant: p }: { participant: RoundParticipant }) {
	return p.withdrawnAt ? (
		<p className="text-xs text-muted-foreground">Withdrew {formatTimestamp(p.withdrawnAt)}</p>
	) : p.submittedAt ? (
		<p className="text-xs">{formatTimestamp(p.submittedAt)}</p>
	) : (
		<p className="text-xs text-amber-700">Not submitted</p>
	);
}

function RoundRowsTable({ rounds }: { rounds: RoundSummary[] }) {
	return (
		<div className="hidden overflow-hidden  sm:block print:block">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={headClass}>Round</TableHead>
						<TableHead className={headClass}>Started</TableHead>
						<TableHead className={headClass}>Completed</TableHead>
						<TableHead className={headClass}>Total test cases</TableHead>
						<TableHead className={headClass}>Iteration Summary</TableHead>
					</TableRow>
				</TableHeader>
				{rounds.map((round) => (
					<TableBody key={round.iterationId} className="break-inside-avoid">
						<TableRow>
							<TableCell className={cellClass}>
								<p className="text-xs font-semibold">{round.name}</p>
							</TableCell>
							<TableCell className={cellClass}>
								<p className="text-xs">{formatTimestamp(round.startedAt)}</p>
							</TableCell>
							<TableCell className={cellClass}>
								<p className="text-xs">{formatTimestamp(round.completedAt)}</p>
							</TableCell>
							<TableCell className={cellClass}>
								<p className="text-xs font-mono">{round.caseCount ?? "—"}</p>
							</TableCell>
							<TableCell className={cellClass}>
								<StatusChips counts={round.counts} />
							</TableCell>
						</TableRow>
						{/* Reports frozen before participants were recorded per round don't have them. */}
						{round.participants && round.participants.length > 0 && (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={5} className="bg-muted/30 p-3">
									<ParticipantTable participants={round.participants} />
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				))}
			</Table>
		</div>
	);
}

function ParticipantTable({ participants }: { participants: RoundParticipant[] }) {
	return (
		<div className="overflow-hidden rounded-md border bg-background">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className={headClass}>Participating Organization</TableHead>
						<TableHead className={headClass}>Date of Submission</TableHead>
						<TableHead className={headClass}>Testing Summary</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{participants.map((p) => (
						<TableRow key={p.organizationName}>
							<TableCell className={cellClass}>
								<p className="text-xs font-semibold">{p.organizationName}</p>
							</TableCell>
							<TableCell className={cellClass}>
								<SubmissionText participant={p} />
							</TableCell>
							<TableCell className={cellClass}>
								<StatusChips counts={p.counts} />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
