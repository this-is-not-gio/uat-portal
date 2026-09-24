"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, Flag } from "lucide-react";
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
import { cancelIteration, completeIteration } from "@/lib/supabase/iteration-actions";
import type { testIteration } from "@/lib/supabase/test-iterations";

// Complete / Cancel for the running round. Cancel is only offered while
// nothing has been recorded; the DB enforces the same rule.
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
	return (
		<div className="flex flex-row items-center gap-2">
			{!hasRecordedResults && <CancelIterationButton iteration={iteration} testSuiteSlug={testSuiteSlug} />}
			<CompleteIterationButton iteration={iteration} untestedCount={untestedCount} />
		</div>
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
					<CircleStop className="h-4 w-4" />
					<p className="text-xs">Cancel Iteration</p>
				</Button>
			} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cancel {iteration.name}?</DialogTitle>
					<DialogDescription>
						Nothing has been recorded in this round yet, so it will be deleted as if it was never started.
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
