"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, FolderPlus, X, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { upsertSection } from "@/lib/supabase/authoring-actions";

// Create a section (then open it) or rename an existing one. Pass `trigger`
// for an uncontrolled dialog, or `open`/`onOpenChange` to drive it from a menu.
export default function SectionDialog({
	suiteId,
	testSuiteSlug,
	section,
	trigger,
	open: controlledOpen,
	onOpenChange,
}: {
	suiteId: string;
	testSuiteSlug: string;
	section?: { id: string; name: string };
	trigger?: React.ReactElement;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const router = useRouter();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [name, setName] = useState(section?.name ?? "");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const isRename = !!section;

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await upsertSection({ suiteId, id: section?.id, name: name.trim() });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			if (!isRename) {
				setName("");
				router.push(`/testingsuite/${testSuiteSlug}/${result.data.slug}?tab=test-cases`);
			}
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setName(section?.name ?? ""); setError(null); }}>
			{trigger && <DialogTrigger render={trigger} />}
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						{isRename ? <Pencil className="size-4" /> : <FolderPlus className="size-4" />}
						{isRename ? "Rename Testing Section" : "Add Testing Section"}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{isRename ? "The new name shows everywhere, including rounds that haven't been synced yet." : "Sections group related test cases, e.g. \"Login and Authentication\"."}
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-2"
					onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave(); }}
				>
					<Label htmlFor="section-name" className="text-xs text-muted-foreground">Section name</Label>
					<Input id="section-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} disabled={isPending} />
					{error && <p className="text-xs text-destructive">{error}</p>}
				</form>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						Cancel
					</DialogClose>
					<Button onClick={onSave} disabled={isPending || !name.trim()}>
						<Plus className="size-4" />
						{isPending ? "Saving…" : isRename ? "Rename" : "Add section"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
