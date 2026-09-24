"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { signOffSuite } from "@/lib/supabase/iteration-actions";
import type { statusCounts } from "@/lib/supabase/overview";

// Formal acceptance of the suite, based on the latest completed iteration.
// Soft gate: exceptions (failed / blocked / untested) are allowed but need a note.
export default function SignOffDialog({
	suiteId,
	hasActiveIteration,
	latestCompleted,
	trigger,
}: {
	suiteId: string;
	hasActiveIteration: boolean;
	latestCompleted: { name: string; counts: statusCounts } | null;
	trigger: React.ReactElement;
}) {
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const blocker = hasActiveIteration
		? "Complete the running iteration before signing off."
		: !latestCompleted
			? "At least one completed iteration is needed to sign off."
			: null;
	const counts = latestCompleted?.counts;
	const hasExceptions = !!counts && counts.passed < counts.total;

	function onSignOff() {
		setError(null);
		startTransition(async () => {
			const result = await signOffSuite({ suiteId, note: note.trim() });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setNote(""); setError(null); } }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Sign off this testing suite</DialogTitle>
					<DialogDescription>
						{latestCompleted ? `Based on ${latestCompleted.name}. Signing off locks the suite; starting a new iteration reopens it.` : "Signing off locks the suite."}
					</DialogDescription>
				</DialogHeader>
				{blocker ? (
					<p className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3">{blocker}</p>
				) : counts && (
					<div className="flex flex-col gap-4">
						<div className="grid grid-cols-5 gap-2 text-center">
							{([
								["Total", counts.total, ""],
								["Passed", counts.passed, "text-green-800"],
								["Failed", counts.failed, "text-red-800"],
								["Blocked", counts.blocked, ""],
								["Not tested", counts.untested + counts.inProgress, "text-muted-foreground"],
							] as const).map(([label, value, className]) => (
								<div key={label} className="border rounded-md p-2">
									<p className={`font-mono font-semibold text-lg ${className}`}>{value}</p>
									<p className="text-xs text-muted-foreground">{label}</p>
								</div>
							))}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="sign-off-note">
								Note {hasExceptions ? <span className="text-destructive font-normal">(required: signing off with exceptions)</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
							</Label>
							<Textarea
								id="sign-off-note"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder={hasExceptions ? "e.g. Accepted with 2 known issues tracked for the next release" : "Anything worth recording with the sign-off"}
								disabled={isPending}
							/>
						</div>
					</div>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button onClick={onSignOff} disabled={isPending || !!blocker || (hasExceptions && !note.trim())}>
						{isPending ? "Signing off…" : hasExceptions ? "Sign off with exceptions" : "Sign off"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
