"use client";

import { useState, useTransition } from "react";
import { ListChecks } from "lucide-react";
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
import { discardSignOffDraft } from "@/lib/supabase/iteration-actions";

// For Sign-off → In Testing (vendor): drops the sign-off draft so rounds and authoring reopen.
export default function BackToTestingButton({ signOffId }: { signOffId: string }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onConfirm() {
		setError(null);
		startTransition(async () => {
			const result = await discardSignOffDraft({ signOffId });
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
				<Button variant="outline" className="flex flex-row items-center gap-2">
					<ListChecks className="h-4 w-4" />
					<p className="text-xs">Back to Testing</p>
				</Button>
			} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Back to testing?</DialogTitle>
					<DialogDescription className="text-xs">
						The sign-off draft and its note are deleted and the suite returns to In Testing. You can create a new draft later.
					</DialogDescription>
				</DialogHeader>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button onClick={onConfirm} disabled={isPending}>
						{isPending ? "Returning…" : "Back to Testing"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
