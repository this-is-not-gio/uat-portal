"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, Flag, Play, RotateCcw, StopCircle, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { beginIteration, cancelIteration, completeIteration, resetIteration, stopIteration } from "@/lib/supabase/iteration-actions";
import type { testIteration } from "@/lib/supabase/test-iterations";
import type { organization } from "@/lib/supabase/organizations";
import UnsubmittedOrgsWarning from "./unsubmitted-orgs-warning";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";

// Lifecycle actions for the open round:
//   not_started: Start / Cancel
//   in_progress: Cancel (back to not_started, results erased) / Stop / Complete
//   stopped:     Reset (back to not_started, results erased)
// The DB enforces the same transitions (begin/stop/complete/cancel/reset_iteration).
export default function IterationActions({
	iteration,
	testSuiteSlug,
	untestedCount,
	hasRecordedResults,
	unsubmittedOrgs = [],
}: {
	iteration: testIteration;
	testSuiteSlug: string;
	untestedCount: number;
	hasRecordedResults: boolean;
	// External participants that haven't submitted yet; Complete warns about them (6.2).
	unsubmittedOrgs?: organization[];
}) {
	if (iteration.status === "not_started") {
		return (
			<div className="flex flex-row items-center gap-2">
				<CancelIterationButton iteration={iteration} testSuiteSlug={testSuiteSlug} />
				<StartIterationButton iteration={iteration} />
			</div>
		);
	}
	if (iteration.status === "stopped") return <ResetIterationButton iteration={iteration} hasRecordedResults={hasRecordedResults} />;
	if (iteration.status !== "in_progress") return null;
	return (
		<div className="flex flex-row items-center gap-2">
			<ResetIterationButton iteration={iteration} hasRecordedResults={hasRecordedResults} label="Cancel Iteration" />
			<StopIterationButton iteration={iteration} />
			<CompleteIterationButton iteration={iteration} untestedCount={untestedCount} unsubmittedOrgs={unsubmittedOrgs} />
		</div>
	);
}

// not_started -> in_progress. begin_iteration rejects a round with no participants or no
// included cases (0027), so the dialog just shows the scope and surfaces that message.
// Sections with nothing ticked are dropped from the round as it starts (0032).
// `disabledReason` greys the button out and explains why in a tooltip.
export function StartIterationButton({ iteration, participantCount, testCaseCount, disabledReason }: { iteration: testIteration; participantCount?: number; testCaseCount?: number; disabledReason?: string }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onStart() {
		setError(null);
		startTransition(async () => {
			const result = await beginIteration({ iterationId: iteration.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	if (disabledReason) {
		return (
			<Tooltip>
				{/* A disabled button fires no pointer events, so the span carries the hover. */}
				<TooltipTrigger render={<span className="inline-flex cursor-not-allowed [&>button]:pointer-events-none" />}>
					<Button size="sm" disabled>
						<Play className="h-4 w-4" />
						<p className="text-xs">Start Iteration</p>
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p className="text-xs">{disabledReason}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
			<DialogTrigger render={
				<Button size="sm">
					<Play className="h-4 w-4" />
					<p className="text-xs">Start Iteration</p>
				</Button>
			} />
			<DialogContent>
				<DialogHeader className="px-2 pt-2">
					<DialogTitle>Start {iteration.name}?</DialogTitle>
					<DialogDescription className="text-xs">
						Participants can start recording results. The test cases in this round are locked once it starts, and sections with no included test cases are removed.
					</DialogDescription>
				</DialogHeader>
				{participantCount !== undefined && testCaseCount !== undefined && (
					<div className="grid grid-cols-2 gap-2 px-2">
						<div className="rounded-md border px-3 py-2">
							<p className="font-mono text-lg font-medium">{participantCount}</p>
							<p className="text-xs text-muted-foreground">{participantCount === 1 ? "Participant" : "Participants"}</p>
						</div>
						<div className="rounded-md border px-3 py-2">
							<p className="font-mono text-lg font-medium">{testCaseCount}</p>
							<p className="text-xs text-muted-foreground">{testCaseCount === 1 ? "Test case" : "Test cases"} to be tested</p>
						</div>
					</div>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Not yet</DialogClose>
					<Button onClick={onStart} disabled={isPending}>
						<Play />
						{isPending ? "Starting…" : "Start iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function StopIterationButton({ iteration }: { iteration: testIteration }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onStop() {
		setError(null);
		startTransition(async () => {
			const result = await stopIteration({ iterationId: iteration.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={
				<Button size="lg" variant="outline" className="flex-1 md:flex-none">
					<CircleStop className="h-4 w-4" />
					<p className="text-xs">Stop Iteration</p>
				</Button>
			} />
			<DialogContent>
				<DialogHeader className="px-2 pt-2">
					<DialogTitle>Stop {iteration.name}?</DialogTitle>
					<DialogDescription className="text-xs">
						Ends the round early. Recorded results are kept as read-only history, but a stopped round can&apos;t be used to sign off the suite.
					</DialogDescription>
				</DialogHeader>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Keep testing</DialogClose>
					<Button variant="destructive" onClick={onStop} disabled={isPending}>
						<StopCircle />
						{isPending ? "Stopping…" : "Stop iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function CompleteIterationButton({ iteration, untestedCount, unsubmittedOrgs }: { iteration: testIteration; untestedCount: number; unsubmittedOrgs: organization[] }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onComplete() {
		setError(null);
		startTransition(async () => {
			const result = await completeIteration({ iterationId: iteration.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={
				<Button size="lg" className="flex-1 md:flex-none">
					<Flag className="h-4 w-4" />
					<p className="text-xs">Complete Iteration</p>
				</Button>
			} />
			{/* Default width on phones; caps at lg and scrolls when the warnings run long. */}
			<DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
				<DialogHeader className="px-2 pt-2">
					<DialogTitle className="break-words">Complete {iteration.name}?</DialogTitle>
					<DialogDescription className="text-xs sm:text-sm">
						Results become read-only history. Corrections go into the next round.
					</DialogDescription>
				</DialogHeader>
				<UnsubmittedOrgsWarning organizations={unsubmittedOrgs} context="complete" />
				{untestedCount > 0 && (
					<div className="text-xs sm:text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3 flex flex-col gap-2">
						<p className="font-medium flex flex-row items-start gap-1.5">
							<TriangleAlert size={16} className="shrink-0 mt-px" /> Warning: Incomplete Testing
						</p>
						<p>
							{untestedCount} test case{untestedCount === 1 ? " is" : "s are"} not fully tested yet. They will be recorded as they stand.
						</p>
					</div>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Keep testing</DialogClose>
					<Button onClick={onComplete} disabled={isPending}>
						<Flag />
						{isPending ? "Completing…" : "Complete iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CancelIterationButton({ iteration, testSuiteSlug }: { iteration: testIteration; testSuiteSlug: string }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onCancel() {
		setError(null);
		startTransition(async () => {
			const result = await cancelIteration({ iterationId: iteration.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			// The cancelled round no longer exists; drop it from the URL.
			router.replace(testResultsHref(testSuiteSlug));
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={
				<Button size="lg" variant="outline">
					<Trash2 className="h-4 w-4" />
					<p className="text-xs">Cancel Iteration</p>
				</Button>
			} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cancel {iteration.name}?</DialogTitle>
					<DialogDescription>
						Nothing has been recorded in this round yet, so it will be deleted as if it was never planned.
					</DialogDescription>
				</DialogHeader>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Keep it</DialogClose>
					<Button variant="destructive" onClick={onCancel} disabled={isPending}>
						{isPending ? "Cancelling…" : "Cancel iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// in_progress/stopped -> not_started. Keeps participants and cases, erases what was recorded.
// On a running round this is the Cancel action; on a stopped one it reopens it for a rerun.
export function ResetIterationButton({ iteration, hasRecordedResults, label = "Reset Iteration" }: { iteration: testIteration; hasRecordedResults: boolean; label?: string }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onReset() {
		setError(null);
		startTransition(async () => {
			const result = await resetIteration({ iterationId: iteration.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
			<DialogTrigger render={
				<Button size="lg" variant="outline">
					<RotateCcw className="h-4 w-4" />
					<p className="text-xs">{label}</p>
				</Button>
			} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="px-2 pt-2">
					<DialogTitle>{label.replace(" Iteration", "")} {iteration.name}?</DialogTitle>
					<DialogDescription className="text-xs">
						The round goes back to Not Started with the same participants and test cases, so it can be started again.
					</DialogDescription>
				</DialogHeader>
				{hasRecordedResults && (
					<div className="text-sm rounded-md border border-red-600/40 bg-red-50 text-red-800 p-3 flex flex-col gap-2">
						<p className="font-medium flex flex-row items-center gap-1">
							<span><TriangleAlert size={16} /></span> Recorded results will be erased
						</p>
						<p className="text-xs">Every step and case status, remark and organization submission in this round is deleted. This can&apos;t be undone.</p>
					</div>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Keep it</DialogClose>
					<Button variant="destructive" onClick={onReset} disabled={isPending}>
						<RotateCcw />
						{isPending ? "Resetting…" : label.replace("Iteration", "iteration")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
