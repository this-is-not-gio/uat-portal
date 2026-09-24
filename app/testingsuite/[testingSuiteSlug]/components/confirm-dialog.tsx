"use client";

import { useState, useTransition } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
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
import type { actionResult } from "@/lib/supabase/iteration-actions";

// Destructive confirm that runs a server action and shows its error inline.
export default function ConfirmDialog({
	title,
	description,
	confirmLabel,
	onConfirm,
	onDone,
	trigger,
	open: controlledOpen,
	onOpenChange,
	body
}: {
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => Promise<actionResult<unknown>>;
	onDone?: () => void;
	trigger?: React.ReactElement;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	body?: React.ReactNode;
}) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function confirm() {
		setError(null);
		startTransition(async () => {
			const result = await onConfirm();
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			onDone?.();
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
			{trigger && <DialogTrigger render={trigger} />}
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="px-2 py-3">
					<DialogTitle className="flex flex-row items-center gap-2">
						<TriangleAlert className="size-4 text-destructive" />
						{title}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{description}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					{body ? <>{body}</> : error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button variant="destructive" onClick={confirm} disabled={isPending}>
						{
							error ? null :
								<Trash2 className="h-3.5 w-3.5" />
						}
						{isPending ? "Working…" : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
