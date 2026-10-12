"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
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
import { useCan } from "@/components/current-user-provider";
import { createManualModule, createManualSection, setManualModulePublished } from "@/lib/supabase/manual-actions";

const ManualEditContext = createContext<boolean>(false);
const ManualEditToggleContext = createContext<() => void>(() => {});

// Edit mode is a per-visit view state, not persisted. Only Admin can turn it on.
export function ManualEditProvider({ children }: { children: React.ReactNode }) {
	const [editing, setEditing] = useState(false);
	const canEdit = useCan("admin_area");
	return (
		<ManualEditContext.Provider value={canEdit && editing}>
			<ManualEditToggleContext.Provider value={() => setEditing((v) => !v)}>
				{children}
			</ManualEditToggleContext.Provider>
		</ManualEditContext.Provider>
	);
}

export function useManualEditing() {
	return useContext(ManualEditContext);
}

export function ManualEditToggle() {
	const canEdit = useCan("admin_area");
	const editing = useManualEditing();
	const toggle = useContext(ManualEditToggleContext);
	if (!canEdit) return null;
	return (
		<Button variant={editing ? "default" : "outline"} size="sm" onClick={toggle} aria-pressed={editing}>
			<Pencil className="size-3.5" />
			{editing ? "Editing" : "Edit"}
		</Button>
	);
}

// Title dialog; creating a module navigates to it (it starts unpublished).
export function NewModuleDialog({ trigger }: { trigger: React.ReactElement }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onCreate() {
		setError(null);
		startTransition(async () => {
			const result = await createManualModule({ title });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			router.push(`/manual/${result.data.slug}`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setTitle(""); setError(null); } }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="flex flex-col px-2 pt-3">
					<DialogTitle className="font-heading font-semibold">New module</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						A module is one client process. It starts as a draft, hidden from non-admins.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4 px-2"
					onSubmit={(e) => { e.preventDefault(); if (title.trim()) onCreate(); }}
				>
					<div className="flex flex-col gap-1">
						<Label htmlFor="module-title" className="text-xs text-muted-foreground">Title</Label>
						<Input id="module-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} placeholder="e.g. SEC Endorsement" />
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancel</DialogClose>
						<Button type="submit" disabled={isPending || !title.trim()}>
							<Plus className="size-4" />
							{isPending ? "Creating…" : "Create module"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// Title dialog; creating a section navigates to it.
export function NewSectionDialog({ moduleId, moduleTitle, trigger }: { moduleId: string; moduleTitle: string; trigger: React.ReactElement }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onCreate() {
		setError(null);
		startTransition(async () => {
			const result = await createManualSection({ moduleId, title });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			router.push(`/manual/${result.data.moduleSlug}/${result.data.slug}`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setTitle(""); setError(null); } }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="flex flex-col px-2 pt-3">
					<DialogTitle className="font-heading font-semibold">New section</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Adds a section to {moduleTitle}.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4 px-2"
					onSubmit={(e) => { e.preventDefault(); if (title.trim()) onCreate(); }}
				>
					<div className="flex flex-col gap-1">
						<Label htmlFor="section-title" className="text-xs text-muted-foreground">Title</Label>
						<Input id="section-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} placeholder="e.g. Submission" />
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancel</DialogClose>
						<Button type="submit" disabled={isPending || !title.trim()}>
							<Plus className="size-4" />
							{isPending ? "Creating…" : "Create section"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// Publish/Unpublish toggle for the module page header. Admin in Edit mode only.
export function PublishModuleButton({ moduleId, isPublished }: { moduleId: string; isPublished: boolean }) {
	const editing = useManualEditing();
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	if (!editing) return null;

	function onToggle() {
		setError(null);
		startTransition(async () => {
			const result = await setManualModulePublished({ id: moduleId, isPublished: !isPublished });
			if (!result.ok) setError(result.error);
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button variant={isPublished ? "outline" : "default"} size="sm" onClick={onToggle} disabled={isPending}>
				{isPublished ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
				{isPending ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
			</Button>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
