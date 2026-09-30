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
import { acknowledgeSignOff, issueSignOff } from "@/lib/supabase/iteration-actions";
import type { signOff, statusCounts } from "@/lib/supabase/overview";
import type { organization } from "@/lib/supabase/organizations";
import UnsubmittedOrgsWarning from "./unsubmitted-orgs-warning";

// Step 1 of sign-off (vendor): issue it on the latest completed iteration.
// Hard gate: every round finished. Untested cases and other exceptions are only warnings.
// The client then acknowledges it (AcknowledgeSignOffDialog), which closes the suite.
export default function SignOffDialog({
	suiteId,
	hasActiveIteration,
	latestCompleted,
	openUntestedCases,
	trigger,
}: {
	suiteId: string;
	hasActiveIteration: boolean;
	latestCompleted: { name: string; counts: statusCounts; unsubmittedOrgs: organization[] } | null;
	openUntestedCases: number;
	trigger: React.ReactElement;
}) {
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const blocker = hasActiveIteration
		? "Every test iteration must be finished first. Complete, stop or cancel the open one."
		: !latestCompleted
			? "At least one completed iteration is needed to issue the sign-off."
			: null;
	const counts = latestCompleted?.counts;
	const hasExceptions = !!counts && counts.passed < counts.total;

	function onSignOff() {
		setError(null);
		startTransition(async () => {
			const result = await issueSignOff({ suiteId, note: note.trim() });
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
					<DialogTitle>Issue sign-off</DialogTitle>
					<DialogDescription>
						{latestCompleted ? `Based on ${latestCompleted.name}. The client acknowledges it to close the suite; starting a new iteration withdraws it.` : "The client acknowledges it to close the suite."}
					</DialogDescription>
				</DialogHeader>
				{blocker ? (
					<p className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3">{blocker}</p>
				) : counts && (
					<div className="flex flex-col gap-4">
						{openUntestedCases > 0 && (
							<p className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3">
								{openUntestedCases} test case{openUntestedCases === 1 ? " has" : "s have"} no finished result yet (never tested in a completed round, or left untested). You can still issue the sign-off.
							</p>
						)}
						<UnsubmittedOrgsWarning organizations={latestCompleted?.unsubmittedOrgs ?? []} context="sign-off" />
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
								Note <span className="text-muted-foreground font-normal">(optional{hasExceptions ? ", recommended with exceptions" : ""})</span>
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
					<Button onClick={onSignOff} disabled={isPending || !!blocker}>
						{isPending ? "Issuing…" : hasExceptions ? "Issue with exceptions" : "Issue sign-off"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Step 2 of sign-off (client): acknowledge the vendor's issued sign-off, closing the suite.
export function AcknowledgeSignOffDialog({ suiteId, signOff, trigger }: { suiteId: string; signOff: signOff; trigger: React.ReactElement }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const counts = signOff.exceptions;

	function onAcknowledge() {
		setError(null);
		startTransition(async () => {
			const result = await acknowledgeSignOff({ suiteId });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Acknowledge sign-off</DialogTitle>
					<DialogDescription>
						{signOff.signedOffBy ?? "The vendor"} issued the sign-off based on {signOff.iterationName}. Acknowledging it closes the suite.
					</DialogDescription>
				</DialogHeader>
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
					{signOff.note && (
						<div className="flex flex-col gap-1">
							<Label>Vendor note</Label>
							<p className="text-sm">{signOff.note}</p>
						</div>
					)}
				</div>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button onClick={onAcknowledge} disabled={isPending}>
						{isPending ? "Acknowledging…" : "Acknowledge & close suite"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
