"use client";

import { useState, useTransition } from "react";
import { Stamp } from "lucide-react";
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
import { issueSignOff } from "@/lib/supabase/iteration-actions";
import type { signOffDraft } from "@/lib/supabase/overview";

// For Sign-off → Sign-off Issued (vendor): publishes the draft to the client with its saved note
// observations and report sections. issueSignOff rebuilds and freezes the report on the server.
export function IssueReportButton({ suiteId, draft }: { suiteId: string; draft: signOffDraft }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onConfirm() {
		setError(null);
		startTransition(async () => {
			const result = await issueSignOff({ suiteId, signOffId: draft.id, note: draft.note, themes: draft.themes, sections: draft.sections });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
			<DialogTrigger render={
				<Button className="w-fit">
					<Stamp />
					<span className="hidden sm:inline text-xs">Issue Report</span>
				</Button>
			} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Issue this sign-off report?</DialogTitle>
					<DialogDescription className="text-xs">
						The report is frozen as it is now and sent to the client, who can acknowledge or reject it. It can&apos;t be edited after issuing.
					</DialogDescription>
				</DialogHeader>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button onClick={onConfirm} disabled={isPending}>
						{isPending ? "Issuing…" : "Issue Report"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
