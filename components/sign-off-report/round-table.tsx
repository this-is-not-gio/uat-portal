"use client";

import { Ban, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { statusCounts } from "@/lib/supabase/overview";
import type { RoundParticipant, RoundSummary } from "@/lib/supabase/sign-off-report";
import { cn, formatTimestamp } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

// One chip per status for a round's counts; in-progress counts as not tested.
const chipsFor = (counts: statusCounts) => [
	{ label: "Passed", value: counts.passed, icon: CircleCheck, className: "text-green-800 bg-green-500/10" },
	{ label: "Failed", value: counts.failed, icon: CircleX, className: "text-red-800 bg-red-500/10" },
	{ label: "Blocked", value: counts.blocked, icon: Ban, className: "text-gray-800 bg-gray-500/10" },
	{ label: "Not tested", value: counts.untested + counts.inProgress, icon: CircleDashed, className: "text-muted-foreground bg-stone-500/10" },
];

function StatusChips({ counts }: { counts: statusCounts }) {
	return (
		<div className="flex flex-row flex-wrap gap-1 justify-end">
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
export function RoundTable({ rounds }: { rounds: RoundSummary[] }) {
	return (
		<div className="overflow-hidden rounded-md border">
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
								{p.withdrawnAt ? (
									<p className="text-xs text-muted-foreground">Withdrew {formatTimestamp(p.withdrawnAt)}</p>
								) : p.submittedAt ? (
									<p className="text-xs">{formatTimestamp(p.submittedAt)}</p>
								) : (
									<p className="text-xs text-amber-700">Not submitted</p>
								)}
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
