"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, FolderPlus, Trash2, X, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deleteSuite, upsertSuite } from "@/lib/supabase/authoring-actions";

type suiteFields = { id: string; name: string; code: string | null; slug: string; description: string; status: string };

// Create a testing suite (starts as Draft) or edit an existing one. Only
// Draft suites can be deleted; the DB enforces that too.
export default function SuiteDialog({ suite, trigger }: { suite?: suiteFields; trigger: React.ReactElement }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState(suite?.name ?? "");
	const [code, setCode] = useState(suite?.code ?? "");
	const [description, setDescription] = useState(suite?.description ?? "");
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const isEdit = !!suite;

	function reset() {
		setName(suite?.name ?? "");
		setCode(suite?.code ?? "");
		setDescription(suite?.description ?? "");
		setConfirmingDelete(false);
		setError(null);
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await upsertSuite({ id: suite?.id, name: name.trim(), code: code.trim(), description });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			if (!isEdit) router.push(`/testingsuite/${result.data.slug}?tab=overview`);
		});
	}

	function onDelete() {
		if (!suite) return;
		setError(null);
		startTransition(async () => {
			const result = await deleteSuite({ suiteId: suite.id });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			router.push("/dashboard");
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(); }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						{isEdit ? <Pencil className="size-4" /> : <FolderPlus className="size-4" />}
						{isEdit ? "Edit testing suite" : "New testing suite"}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{isEdit ? "Changes apply to the live suite." : "The suite starts as a Draft, hidden from testers until it's marked ready."}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					<div className="flex flex-col gap-1">
						<Label htmlFor="suite-name" className="text-xs text-muted-foreground">Testing Suite Name</Label>
						<Input id="suite-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="suite-code" className="text-xs text-muted-foreground flex flex-row justify-between">
							 <span>Code</span>
							 <span className="text-muted-foreground text-xs">(optional, prefixes test case codes e.g. LCI-001)</span></Label>
						<Input id="suite-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={isPending} />
					</div>
				</div>
				<DialogFooter className="sm:justify-between">
					{isEdit && suite.status === "draft" ? (
						<Button variant={confirmingDelete ? "destructive" : "ghost"} disabled={isPending} onClick={() => confirmingDelete ? onDelete() : setConfirmingDelete(true)}>
							<Trash2 className="size-4" />
							{confirmingDelete ? "Click again to delete" : "Delete suite"}
						</Button>
					) : <span />}
					<div className="flex flex-row gap-2">
						<DialogClose render={<Button variant="outline" disabled={isPending} />}>
							Cancel
						</DialogClose>
						<Button onClick={onSave} disabled={isPending || !name.trim()}>
							<Plus className="size-4" />
							{isPending ? "Saving…" : isEdit ? "Save" : "Create suite"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
