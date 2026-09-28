"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, Flag, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { beginIteration, cancelIteration, completeIteration, stopIteration } from "@/lib/supabase/iteration-actions";
import type { testIteration } from "@/lib/supabase/test-iterations";

// Lifecycle actions for the open round:
//   not_started: Start / Cancel
//   in_progress: Stop / Complete, plus Cancel while nothing has been recorded
// The DB enforces the same transitions (begin/stop/complete/cancel_iteration).
export default function IterationActions({
	iteration,
	testSuiteSlug,
	untestedCount,
	hasRecordedResults,
}: {
	iteration: testIteration;
	testSuiteSlug: string;
	untestedCount: number;
	hasRecordedResults: boolean;
}) {
	if (iteration.status === "not_started") {
		return (
			<div className="flex flex-row items-center gap-2">
				<CancelIterationButton iteration={iteration} testSuiteSlug={testSuiteSlug} />
				<StartIterationButton iteration={iteration} />
			</div>
		);
	}
	if (iteration.status !== "in_progress") return null;
	return (
		<div className="flex flex-row items-center gap-2">
			{!hasRecordedResults && <CancelIterationButton iteration={iteration} testSuiteSlug={testSuiteSlug} />}
			<StopIterationButton iteration={iteration} />
			<CompleteIterationButton iteration={iteration} untestedCount={untestedCount} />
		</div>
	);
}

function StartIterationButton({ iteration }: { iteration: testIteration }) {
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onStart() {
		setError(null);
		startTransition(async () => {
			const result = await beginIteration({ iterationId: iteration.id });
			if (!result.ok) setError(result.error);
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button size="lg" onClick={onStart} disabled={isPending}>
				<Play className="h-4 w-4" />
				<p className="text-xs">{isPending ? "Starting…" : "Start Iteration"}</p>
			</Button>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}

function StopIterationButton({ iteration }: { iteration: testIteration }) {
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
				<Button size="lg" variant="outline">
					<CircleStop className="h-4 w-4" />
					<p className="text-xs">Stop Iteration</p>
				</Button>
			} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Stop {iteration.name}?</DialogTitle>
					<DialogDescription>
						Ends the round early. Recorded results are kept as read-only history, but a stopped round can&apos;t be used to sign off the suite.
					</DialogDescription>
				</DialogHeader>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Keep testing</DialogClose>
					<Button variant="destructive" onClick={onStop} disabled={isPending}>
						{isPending ? "Stopping…" : "Stop iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CompleteIterationButton({ iteration, untestedCount }: { iteration: testIteration; untestedCount: number }) {
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
				<Button size="lg">
					<Flag className="h-4 w-4" />
					<p className="text-xs">Complete Iteration</p>
				</Button>
			} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Complete {iteration.name}?</DialogTitle>
					<DialogDescription>
						Results become read-only history. Corrections go into the next round.
					</DialogDescription>
				</DialogHeader>
				{untestedCount > 0 && (
					<p className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3">
						{untestedCount} test case{untestedCount === 1 ? " is" : "s are"} not fully tested yet. They will be recorded as they stand.
					</p>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Keep testing</DialogClose>
					<Button onClick={onComplete} disabled={isPending}>
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
			router.replace(`/testingsuite/${testSuiteSlug}?tab=test-results`);
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
