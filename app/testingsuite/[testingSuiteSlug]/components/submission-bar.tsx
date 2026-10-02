"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { CircleCheck, Send, Undo2 } from "lucide-react";
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
import { submitParticipation, withdrawParticipation } from "@/lib/supabase/iteration-actions";
import type { statusCounts } from "@/lib/supabase/overview";
import type { testIteration } from "@/lib/supabase/test-iterations";

export type untestedCase = { id: string; code: string | null; title: string; sectionName: string | null };

// External's "we're done" for a round (playbook 6.3, decisions D2/D3). Submitting locks the
// org's rows in the DB (0014's guard); withdrawing unlocks them while the round is still open.
export default function SubmissionBar({
	iteration,
	organizationName,
	counts,
	submittedAt,
	canWithdraw = false,
	untestedCases,
}: {
	iteration: testIteration;
	organizationName: string;
	counts: statusCounts;
	submittedAt: string | null;
	// Round still in progress (can_withdraw_participation, 0019).
	canWithdraw?: boolean;
	// Across the whole round for this org, not just the visible section.
	untestedCases: untestedCase[];
}) {
	const isRunning = iteration.status === "in_progress";
	const tested = counts.passed + counts.failed + counts.blocked;

	if (submittedAt) {
		return (
			<div className="flex flex-row items-center justify-between gap-4 rounded-md border border-green-800/30 bg-green-50/50 px-4 py-3">
				<div className="flex flex-row items-center gap-3">
					<CircleCheck className="size-5 text-green-800" />
					<div>
						<p className="text-sm font-medium">{organizationName} submitted its results on <span className="font-mono">{format(parseISO(submittedAt), "MMM d yyyy, h:mm a")}</span></p>
						<p className="text-xs text-muted-foreground">
							{canWithdraw ? "Results are read-only. Withdraw the submission to make changes until the round is completed." : "Results are read-only."}
						</p>
					</div>
				</div>
				{canWithdraw && <WithdrawButton iterationId={iteration.id} />}
			</div>
		);
	}

	if (!isRunning) return null;

	return (
		<div className="flex flex-row items-center justify-between gap-4 rounded-md border px-4 py-3">
			<div>
				<p className="text-sm font-medium">{tested} / {counts.total} tested</p>
				<p className="text-xs text-muted-foreground">
					{untestedCases.length > 0 ? `${untestedCases.length} left. ` : "Everything has a result. "}
					Submit when {organizationName} is done testing this round.
				</p>
			</div>
			<SubmitDialog iteration={iteration} organizationName={organizationName} untestedCases={untestedCases} />
		</div>
	);
}

// trigger: a custom button to open it (the tester header's "Submit Result"); defaults to the bar's own.
export function SubmitDialog({ iteration, organizationName, untestedCases, trigger }: { iteration: testIteration; organizationName: string; untestedCases: untestedCase[]; trigger?: React.ReactElement }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Grouped by section for the D2 warning, in the order the rows came in.
	const bySection = new Map<string, untestedCase[]>();
	for (const c of untestedCases) {
		const key = c.sectionName ?? "No section";
		bySection.set(key, [...(bySection.get(key) ?? []), c]);
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
			<DialogTrigger render={trigger ?? (
				<Button size="lg">
					<Send className="h-4 w-4" />
					<p className="text-xs">Submit our results</p>
				</Button>
			)} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Submit {organizationName}&apos;s results for {iteration.name}?</DialogTitle>
					<DialogDescription>
						Your team can&apos;t change results after submitting. You can withdraw the submission while the round is still open.
					</DialogDescription>
				</DialogHeader>
				{untestedCases.length > 0 && (
					<div className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3 flex flex-col gap-2">
						<p>
							{untestedCases.length} test case{untestedCases.length === 1 ? " wasn't" : "s weren't"} tested and will be submitted as not tested.
						</p>
						<div className="max-h-48 overflow-y-auto flex flex-col gap-2">
							{[...bySection].map(([section, cases]) => (
								<div key={section}>
									<p className="text-xs font-medium">{section}</p>
									<ul className="list-disc pl-5 text-xs">
										{cases.map((c) => (
											<li key={c.id}>{c.code ? <span className="font-mono">{c.code} </span> : null}{c.title}</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</div>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Go back</DialogClose>
					<Button onClick={onSubmit} disabled={isPending}>
						{isPending ? "Submitting…" : untestedCases.length > 0 ? "Submit anyway" : "Submit"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function WithdrawButton({ iterationId }: { iterationId: string }) {
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onWithdraw() {
		setError(null);
		startTransition(async () => {
			const result = await withdrawParticipation({ iterationId });
			if (!result.ok) setError(result.error);
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button size="lg" variant="outline" className="text-foreground" onClick={onWithdraw} disabled={isPending}>
				<Undo2 className="h-4 w-4" />
				<p className="text-xs">{isPending ? "Withdrawing…" : "Withdraw submission"}</p>
			</Button>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
