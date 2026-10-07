"use client";

import { useState, useTransition } from "react";
import { Ban, CircleCheck, CircleX, ClipboardCheck, Send } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { submitParticipation } from "@/lib/supabase/iteration-actions";
import type { statusCounts } from "@/lib/supabase/overview";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { Progress } from "@/components/ui/progress";

// Header "Submit Result" for Internal/External: hands the org's results for the running round back
// to the vendor. Enabled only once every assigned case has a result; submitting locks the rows,
// and the last org to submit finishes the round (0017).
export default function SubmitResultsDialog({
	iteration,
	organizationName,
	counts,
	tested,
	othersPending,
}: {
	iteration: testIteration;
	organizationName: string;
	// The org's own rows in this round.
	counts: statusCounts;
	tested: number;
	// Other testing orgs still to submit.
	othersPending: number;
}) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const isRunning = iteration.status === "in_progress";

	const blockedReason =
		!isRunning ? "This round isn't running, so there's nothing to submit."
			: tested < counts.total ? `Test every case assigned to ${organizationName} first (${counts.total - tested} left).`
				: null;

	const trigger = (
		<Button disabled={!!blockedReason} className="flex flex-row items-center gap-2">
			<ClipboardCheck className="h-4 w-4" />
			<p className="text-xs">Submit Result</p>
		</Button>
	);

	if (blockedReason) {
		return (
			<Tooltip>
				{/* A disabled button fires no pointer events, so the span carries the hover. */}
				<TooltipTrigger render={<span className="inline-flex" />}>{trigger}</TooltipTrigger>
				<TooltipContent>
					<p className="text-xs">{blockedReason}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	function onSubmit() {
		setError(null);
		startTransition(async () => {
			const result = await submitParticipation({ iterationId: iteration.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="px-2 pt-2">
					<DialogTitle>Submit results for {iteration.name}?</DialogTitle>
					<DialogDescription className="text-xs">
						This sends {organizationName}&apos;s results to the developers. Your team can&apos;t change them after submitting
					</DialogDescription>
				</DialogHeader>
				<div className="px-2">
					<div className="flex flex-row justify-between items-end">
						<div className="">
							<p className="text-xs text-muted-foreground">Testing Iteration:</p>
							<p className="font-medium">{iteration.name}</p>
						</div>
						<div className="">
							<p><span className="font-mono">{tested}</span>/<span className="font-mono">{counts.total}</span> Test cases</p> 
						</div>
					</div>
				</div>
				<div className="grid grid-cols-3 gap-2 px-2">
					<div className="flex flex-col items-center gap-1 rounded-md border border-green-800/30 bg-green-50/50 p-3">
						<CircleCheck className="size-4 text-green-800" />
						<p className="font-mono text-sm">{counts.passed}</p>
						<p className="text-xs text-muted-foreground">Passed</p>
					</div>
					<div className="flex flex-col items-center gap-1 rounded-md border border-red-800/30 bg-red-50/50 p-3">
						<CircleX className="size-4 text-red-800" />
						<p className="font-mono text-sm">{counts.failed}</p>
						<p className="text-xs text-muted-foreground">Failed</p>
					</div>
					<div className="flex flex-col items-center gap-1 rounded-md border p-3">
						<Ban className="size-4 text-gray-800" />
						<p className="font-mono text-sm">{counts.blocked}</p>
						<p className="text-xs text-muted-foreground">Blocked</p>
					</div>
				</div>
				<p className="px-2 text-xs text-muted-foreground">
					{othersPending === 0
						? `${organizationName} is the last to submit. ${iteration.name} stays open until it's completed, and you can withdraw until then.`
						: `${othersPending === 1 ? "1 other organization hasn't" : `${othersPending} other organizations haven't`} submitted yet. You can withdraw until ${iteration.name} is completed.`}
				</p>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Go back</DialogClose>
					<Button onClick={onSubmit} disabled={isPending}>
						{isPending ? "Submitting…" : "Submit"}
						<Send className="h-4 w-4" />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
