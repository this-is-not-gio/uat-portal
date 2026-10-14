"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Eye, EyeOff, FolderPen, Pencil, Plus, Save, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/markdown-editor";
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
import ConfirmDialog from "@/components/confirm-dialog";
import { useCan } from "@/components/current-user-provider";
import {
	createManualBlock,
	createManualModule,
	createManualSection,
	deleteManualModule,
	deleteManualSection,
	renameManualModule,
	renameManualSection,
	setManualModulePublished,
	updateManualBlock,
} from "@/lib/supabase/manual-actions";
import { arrayMove } from "@dnd-kit/sortable";
import { reorderManualBlocks } from "@/lib/supabase/manual-reorder-actions";
import { emptyBlockData, hasBlockHeader, type blockData, type blockType } from "@/lib/manual/blocks";
import type { manualBlock, manualBlockContainer } from "@/lib/supabase/manual";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const ManualEditContext = createContext<boolean>(false);
const ManualContentEditContext = createContext<boolean>(false);
const ManualEditToggleContext = createContext<(editing: boolean) => void>(() => { });
const ManualContentToggleContext = createContext<(editing: boolean) => void>(() => { });

// Two per-visit view states, neither persisted; only Admin can turn them on.
// - Edit mode (the sidebar switch): admin tools are available (status banner, structure editing).
// - Content editing (the banner's "Edit Content"): the page's title and blocks are open fields.
//   It belongs to the page it was started on, so navigating away ends it, and edit mode off ends it.
export function ManualEditProvider({ children }: { children: React.ReactNode }) {
	const [editing, setEditing] = useState(false);
	const [contentPath, setContentPath] = useState<string | null>(null);
	const pathname = usePathname();
	const canEdit = useCan("admin_area");
	const setEditMode = (next: boolean) => {
		setEditing(next);
		if (!next) setContentPath(null);
	};
	const setContentEditing = (next: boolean) => setContentPath(next ? pathname : null);
	return (
		<ManualEditContext.Provider value={canEdit && editing}>
			<ManualContentEditContext.Provider value={canEdit && editing && contentPath === pathname}>
				<ManualEditToggleContext.Provider value={setEditMode}>
					<ManualContentToggleContext.Provider value={setContentEditing}>
						{children}
					</ManualContentToggleContext.Provider>
				</ManualEditToggleContext.Provider>
			</ManualContentEditContext.Provider>
		</ManualEditContext.Provider>
	);
}

// Edit mode (the sidebar switch).
export function useManualEditing() {
	return useContext(ManualEditContext);
}

// The page's title and blocks are open fields.
export function useManualContentEditing() {
	return useContext(ManualContentEditContext);
}

export function ManualEditToggle() {
	const canEdit = useCan("admin_area");
	const editing = useManualEditing();
	const setEditing = useContext(ManualEditToggleContext);
	if (!canEdit) return null;
	return (
		<div className="border-t border-border p-4 flex items-center justify-between gap-4 absolute bottom-2 left-0 right-0">
			<div className="">
				<p id="manual-edit-toggle-label" className="font-heading font-semibold text-sm">Enable Edit Content</p>
				<p className="text-xs text-muted-foreground">Toggle editing mode for the manual content</p>
			</div>
			<Switch
				checked={editing}
				onCheckedChange={(checked) => setEditing(checked)}
				aria-labelledby="manual-edit-toggle-label"
			/>
		</div>
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
					id="new-module-form"
					className="flex flex-col gap-4 px-2"
					onSubmit={(e) => { e.preventDefault(); if (title.trim() && !isPending) onCreate(); }}>
					<div className="flex flex-col gap-1">
						<Label htmlFor="module-title" className="text-xs text-muted-foreground">Module Title</Label>
						<Input id="module-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} disabled={isPending} placeholder="e.g. SEC Endorsement" />
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
				</form>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button type="submit" form="new-module-form" disabled={isPending || !title.trim()}>
						<Plus className="size-4" />
						{isPending ? "Creating…" : "Create module"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Title dialog; creating a section navigates to it.
export function NewSectionDialog({ moduleId, moduleTitle, trigger, tooltip }: { moduleId: string; moduleTitle: string; trigger: React.ReactElement; tooltip?: string }) {
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
			{tooltip ? (
				<Tooltip>
					<TooltipTrigger render={<DialogTrigger render={trigger} />} />
					<TooltipContent>{tooltip}</TooltipContent>
				</Tooltip>
			) : <DialogTrigger render={trigger} />}
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
	const contentEditing = useManualContentEditing();
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	// Hidden while the content form is open, so a module isn't published with unsaved changes.
	if (!editing || contentEditing) return null;

	function onToggle() {
		setError(null);
		startTransition(async () => {
			const result = await setManualModulePublished({ id: moduleId, isPublished: !isPublished });
			if (!result.ok) setError(result.error);
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button variant={isPublished ? "outline" : "default"} size="lg" onClick={onToggle} disabled={isPending}>
				{isPublished ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
				<p className="text-xs">{isPending ? "Saving…" : isPublished ? "Unpublish Content" : "Publish Content"}</p>
			</Button>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}

type blockDraft = { header: string; body: string; data: blockData };

// A block added in edit mode and not saved yet.
export type newBlockDraft = blockDraft & { key: string; blockType: blockType };

// Nothing typed yet: dropped on save instead of failing the header check.
const isBlankNewBlock = (b: newBlockDraft) =>
	(!hasBlockHeader(b.blockType) || !b.header.trim()) && !b.body.trim() && !(b.data.title ?? "").trim() && !(b.data.rows ?? []).some((row) => row.some((cell) => cell.trim()));

type ManualDraft = {
	title: string;
	description: string;
	setDescription: (value: string) => void;
	setTitle: (value: string) => void;
	blockDraft: (block: manualBlock) => blockDraft;
	newBlocks: newBlockDraft[];
	// Saved block ids and new-block keys in the order shown; dragging only changes this until Save.
	orderedIds: string[];
	moveBlock: (activeId: string, overId: string) => void;
	addNewBlock: (type: blockType) => void;
	setNewBlock: (key: string, patch: Partial<newBlockDraft>) => void;
	removeNewBlock: (key: string) => void;
	setBlockDraft: (id: string, patch: Partial<blockDraft>) => void;
	isPending: boolean;
	error: string | null;
	save: () => void;
	cancel: () => void;
};

const ManualDraftContext = createContext<ManualDraft | null>(null);

export function useManualDraft() {
	const context = useContext(ManualDraftContext);
	if (!context) throw new Error("useManualDraft must be used inside ManualPageDraftProvider");
	return context;
}

// Edit mode is a form: the title and every block are open fields, saved together with one
// Save/Cancel (like the suite Overview). Remounts on page change and on toggling edit mode,
// so the drafts always start from the saved content.
export function ManualPageDraftProvider(props: { kind: "module" | "section"; id: string; container: manualBlockContainer; title: string; description: string; blocks: manualBlock[]; children: React.ReactNode }) {
	const editing = useManualContentEditing();
	return <ManualPageDraftInner key={`${props.id}:${editing}`} {...props} />;
}

function ManualPageDraftInner({ kind, id, container, title: savedTitle, description: savedDescription, blocks, children }: { kind: "module" | "section"; id: string; container: manualBlockContainer; title: string; description: string; blocks: manualBlock[]; children: React.ReactNode }) {
	const setContentEditing = useContext(ManualContentToggleContext);
	const [title, setTitle] = useState(savedTitle);
	const [description, setDescription] = useState(savedDescription);
	const [drafts, setDrafts] = useState<Record<string, blockDraft>>({});
	const [newBlocks, setNewBlocks] = useState<newBlockDraft[]>([]);
	const [order, setOrder] = useState<string[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const blockDraft = (block: manualBlock) => drafts[block.id] ?? { header: block.header, body: block.body, data: block.data };
	const setBlockDraft = (blockId: string, patch: Partial<blockDraft>) => {
		const block = blocks.find((b) => b.id === blockId);
		if (!block) return;
		setDrafts((prev) => ({ ...prev, [blockId]: { ...(prev[blockId] ?? { header: block.header, body: block.body, data: block.data }), ...patch } }));
	};

	const addNewBlock = (type: blockType) => setNewBlocks((prev) => [...prev, { key: crypto.randomUUID(), blockType: type, header: "", body: "", data: emptyBlockData(type) }]);
	const setNewBlock = (key: string, patch: Partial<newBlockDraft>) => setNewBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
	const removeNewBlock = (key: string) => setNewBlocks((prev) => prev.filter((b) => b.key !== key));

	// The dragged order, with anything added or removed since slotted back in (new blocks go last).
	const defaultIds = [...blocks.map((b) => b.id), ...newBlocks.map((b) => b.key)];
	const orderedIds = order ? [...order.filter((x) => defaultIds.includes(x)), ...defaultIds.filter((x) => !order.includes(x))] : defaultIds;
	const moveBlock = (activeId: string, overId: string) => {
		const from = orderedIds.indexOf(activeId);
		const to = orderedIds.indexOf(overId);
		if (from !== -1 && to !== -1) setOrder(arrayMove(orderedIds, from, to));
	};

	function save() {
		setError(null);
		if (!title.trim()) return setError("The title can't be empty.");
		const changed = blocks.filter((b) => {
			const d = drafts[b.id];
			return d && (d.header !== b.header || d.body !== b.body || JSON.stringify(d.data) !== JSON.stringify(b.data));
		});
		if (changed.some((b) => !drafts[b.id].header.trim())) return setError("Every block needs a header.");
		const added = newBlocks.filter((b) => !isBlankNewBlock(b));
		if (added.some((b) => hasBlockHeader(b.blockType) && !b.header.trim())) return setError("Every block needs a header.");
		startTransition(async () => {
			if (title.trim() !== savedTitle || description.trim() !== savedDescription.trim()) {
				const result = kind === "module" ? await renameManualModule({ id, title, description }) : await renameManualSection({ id, title, description });
				if (!result.ok) return setError(result.error);
			}
			for (const block of changed) {
				const result = await updateManualBlock({ id: block.id, ...drafts[block.id] });
				if (!result.ok) return setError(result.error);
			}
			const createdIds = new Map<string, string>();
			for (const block of added) {
				const { key, ...value } = block;
				const result = await createManualBlock({ ...container, ...value });
				if (!result.ok) return setError(result.error);
				createdIds.set(key, result.data.id);
			}
			// Blank new blocks are dropped; the rest take the order they were dragged into.
			const finalIds = orderedIds.filter((x) => !newBlocks.some((b) => b.key === x) || createdIds.has(x)).map((x) => createdIds.get(x) ?? x);
			const createdInOrder = [...blocks.map((b) => b.id), ...added.map((b) => createdIds.get(b.key)!)];
			if (finalIds.some((x, i) => x !== createdInOrder[i])) {
				const result = await reorderManualBlocks({ ...container, blockIds: finalIds });
				if (!result.ok) return setError(result.error);
			}
			setNewBlocks([]);
			setOrder(null);
			setContentEditing(false);
		});
	}

	return (
		<ManualDraftContext.Provider value={{ title, setTitle, description, setDescription, blockDraft, setBlockDraft, newBlocks, orderedIds, moveBlock, addNewBlock, setNewBlock, removeNewBlock, isPending, error, save, cancel: () => setContentEditing(false) }}>
			{children}
		</ManualDraftContext.Provider>
	);
}

// Header buttons for module and section pages, in edit mode only: "Edit Content" opens the page's form;
// while it is open, "Cancel" discards it and "Save Content" saves and closes it.
export function ManualContentButton() {
	const editMode = useManualEditing();
	const contentEditing = useManualContentEditing();
	const setContentEditing = useContext(ManualContentToggleContext);
	const { isPending, error, save, cancel } = useManualDraft();
	if (!editMode) return null;
	return (
		<>
			{error && <p className="text-xs text-destructive">{error}</p>}
			{contentEditing ? (
				<>
					<Button type="button" size="lg" variant="outline" className="text-xs" onClick={cancel} disabled={isPending}>
						Cancel
					</Button>
					<Button type="button" size="lg" className="text-xs" onClick={save} disabled={isPending}>
						<Save className="size-4" />
						{isPending ? "Saving…" : "Save Content"}
					</Button>
				</>
			) : (
				<Button type="button" size="lg" variant="outline" className="text-xs" onClick={() => setContentEditing(true)}>
					<Pencil className="size-4" />
					Edit Content
				</Button>
			)}
		</>
	);
}

// Title block: the page title and a short description. Open inputs in Edit mode.
// The slug (and URL) never changes.
export function ManualTitleBlock({ kind, title, description }: { kind: "module" | "section"; title: string; description: string }) {
	const editing = useManualContentEditing();
	const draft = useManualDraft();
	const noun = kind === "module" ? "Module" : "Section";

	if (!editing) {
		return (
			<div className="flex w-full flex-col gap-2 mb-5">
				<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
				{description.trim() && (
					<div className="typeset text-sm text-muted-foreground">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
					</div>
				)}
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-4 w-full">
			<div className="flex flex-col gap-1">
				<Label htmlFor="manual-title" className="text-xs text-muted-foreground">{noun} title</Label>
				<Input
					id="manual-title"
					value={draft.title}
					onChange={(e) => draft.setTitle(e.target.value)}
					placeholder={`${noun} title`}
					className="h-10 text-xl"
				/>
			</div>
			<div className="flex flex-col gap-1">
				<Label className="text-xs text-muted-foreground">{noun} description</Label>
				<MarkdownEditor
					value={draft.description}
					onChange={draft.setDescription}
					preview={false}
					placeholder={`What is this ${kind} about? Markdown is supported.`}
				/>
			</div>
		</div>
	);
}

// Deleting a module wipes its sections and blocks, so the module's name must be typed to confirm.
export function DeleteModuleButton({ moduleId, moduleTitle }: { moduleId: string; moduleTitle: string }) {
	const editing = useManualEditing();
	const [typed, setTyped] = useState("");
	if (!editing) return null;

	return (
		<ConfirmDialog
			title={`Delete "${moduleTitle}"?`}
			description="This permanently removes the module with all its sections and content blocks."
			confirmLabel="Delete module"
			confirmDisabled={typed !== moduleTitle}
			onConfirm={() => deleteManualModule({ id: moduleId })}
			trigger={
				<Button variant="outline" size="lg" className="text-xs" onClick={() => setTyped("")}>
					<Trash2 className="size-4" />
					Delete
				</Button>
			}
			body={
				<div className="flex flex-col gap-1">
					<Label htmlFor="confirm-module-name" className="text-xs text-muted-foreground">
						Type <span className="font-semibold text-foreground">{moduleTitle}</span> to confirm
					</Label>
					<Input id="confirm-module-name" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
				</div>
			}
		/>
	);
}

export function DeleteSectionButton({ sectionId, sectionTitle }: { sectionId: string; sectionTitle: string }) {
	const editing = useManualEditing();
	if (!editing) return null;

	return (
		<ConfirmDialog
			title={`Delete "${sectionTitle}"?`}
			description="This removes the section and all its content blocks."
			confirmLabel="Delete section"
			onConfirm={() => deleteManualSection({ id: sectionId })}
			trigger={
				<Button variant="outline" size="lg" className="text-xs">
					<Trash2 className="size-4" />
					Delete
				</Button>
			}
		/>
	);
}

// The body of a manual page inside DocShell. While the content is being edited the title and blocks are
// separate fields, so they get room between them; read mode lets the blocks' own margins flow as a document.
export function ManualDocBody({ children }: { children: React.ReactNode }) {
	return <div className={useManualContentEditing() ? "space-y-10" : undefined}>{children}</div>;
}

// Renders its children unless the page's content is being edited, for server-rendered page chrome
// that the edit form replaces.
export function HideWhenEditing({ children }: { children: React.ReactNode }) {
	return useManualContentEditing() ? null : <>{children}</>;
}

type contentState = "draft" | "edit" | "published";

// Sections follow their module's publish state, so their copy points back to the module.
const contentStates: Record<contentState, { icon: typeof Eye; title: string; description: Record<"module" | "section", string> }> = {
	draft: {
		icon: FolderPen,
		title: "Drafted Content",
		description: {
			module: "This module is a draft and hidden from everyone but admins. Publish it when it's ready.",
			section: "This section's module is a draft, so it's hidden from everyone but admins.",
		},
	},
	edit: {
		icon: Pencil,
		title: "Editing Content",
		description: {
			module: "You are editing this module. Save your changes or cancel to go back.",
			section: "You are editing this section. Save your changes or cancel to go back.",
		},
	},
	published: {
		icon: Eye,
		title: "Published Content",
		description: {
			module: "This module is live and visible to everyone.",
			section: "This section's module is live, so it's visible to everyone.",
		},
	},
};

// Header banner for module and section pages. Only shown in edit mode (the sidebar switch). The state
// is derived: Edit while the page's content is open for editing, otherwise Draft or Published from
// the module itself. `children` are the header's action buttons.
export function ManualStatusBanner({ kind = "module", isPublished, children }: { kind?: "module" | "section"; isPublished: boolean; children?: React.ReactNode }) {
	const editMode = useManualEditing();
	const contentEditing = useManualContentEditing();
	if (!editMode) return null;
	const state: contentState = contentEditing ? "edit" : isPublished ? "published" : "draft";
	const { icon: Icon, title, description: descriptions } = contentStates[state];
	const description = descriptions[kind];
	return (
		<div className="bg-gray-100/5 w-full py-4 px-6 border-b flex flex-row items-center gap-4" data-state={state}>
			<div className="flex flex-row items-center gap-4">
				<Icon />
				<div>
					<p className="font-semibold text-sm">{title}</p>
					<p className="text-xs">{description}</p>
				</div>
			</div>
			<div className="ml-auto flex items-center gap-1">{children}</div>
		</div>
	);
}
