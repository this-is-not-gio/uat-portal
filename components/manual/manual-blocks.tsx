"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/confirm-dialog";
import { MarkdownEditor } from "@/components/markdown-editor";
import { useManualEditing } from "@/components/manual/manual-edit";
import { createManualBlock, deleteManualBlock, updateManualBlock } from "@/lib/supabase/manual-actions";
import type { manualBlock, manualBlockContainer } from "@/lib/supabase/manual";

// Header + markdown editor for one block. Saves on its own; Cancel discards the edit.
function BlockEditor({
	initial,
	onSave,
	onCancel,
	saveLabel,
}: {
	initial: { header: string; body: string };
	onSave: (value: { header: string; body: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
	onCancel: () => void;
	saveLabel: string;
}) {
	const [header, setHeader] = useState(initial.header);
	const [body, setBody] = useState(initial.body);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function save() {
		setError(null);
		startTransition(async () => {
			const result = await onSave({ header, body });
			if (!result.ok) setError(result.error);
		});
	}

	return (
		<div className="space-y-3">
			<Input
				autoFocus
				value={header}
				onChange={(e) => setHeader(e.target.value)}
				disabled={isPending}
				placeholder="Block header"
				aria-label="Block header"
			/>
			<MarkdownEditor
				value={body}
				onChange={setBody}
				disabled={isPending}
				placeholder="Write the block content in Markdown…"
				actions={
					<>
						<Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
						<Button type="button" size="sm" onClick={save} disabled={isPending || !header.trim()}>
							{isPending ? "Saving…" : saveLabel}
						</Button>
					</>
				}
			/>
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
}

function BlockView({ block, anchor }: { block: manualBlock; anchor: string }) {
	const editing = useManualEditing();
	const [isEditing, setIsEditing] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	if (editing && isEditing) {
		return (
			<section id={anchor} className="scroll-mt-8">
				<BlockEditor
					initial={block}
					saveLabel="Save"
					onCancel={() => setIsEditing(false)}
					onSave={async (value) => {
						const result = await updateManualBlock({ id: block.id, ...value });
						if (result.ok) setIsEditing(false);
						return result;
					}}
				/>
			</section>
		);
	}

	return (
		<section id={anchor} className="scroll-mt-8 space-y-3">
			<div className="flex items-start justify-between gap-3">
				<h2 className="text-xl font-semibold tracking-tight">{block.header}</h2>
				{editing && (
					<div className="flex shrink-0 items-center gap-1">
						<Button type="button" variant="ghost" size="icon-sm" aria-label="Edit block" onClick={() => setIsEditing(true)}>
							<Pencil className="size-3.5" />
						</Button>
						<Button type="button" variant="ghost" size="icon-sm" aria-label="Delete block" onClick={() => setDeleteOpen(true)}>
							<Trash2 className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			{block.body.trim() && (
				<div className="typeset text-sm">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{block.body}</ReactMarkdown>
				</div>
			)}
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete "${block.header}"?`}
				description="This block and its content will be removed from the manual."
				confirmLabel="Delete block"
				onConfirm={() => deleteManualBlock({ id: block.id })}
			/>
		</section>
	);
}

// The blocks of one module or section page. `container` says where new blocks go,
// so the section pages can reuse this as-is.
export function ManualBlockList({
	container,
	blocks,
	anchors,
}: {
	container: manualBlockContainer;
	blocks: manualBlock[];
	anchors: string[];
}) {
	const editing = useManualEditing();
	const [adding, setAdding] = useState(false);

	return (
		<>
			{blocks.map((block, i) => (
				<BlockView key={block.id} block={block} anchor={anchors[i]} />
			))}
			{editing && blocks.length === 0 && !adding && (
				<p className="text-sm text-muted-foreground">No content yet.</p>
			)}
			{editing && (adding ? (
				<BlockEditor
					initial={{ header: "", body: "" }}
					saveLabel="Add block"
					onCancel={() => setAdding(false)}
					onSave={async (value) => {
						const result = await createManualBlock({ ...container, ...value });
						if (result.ok) setAdding(false);
						return result;
					}}
				/>
			) : (
				<Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
					<Plus className="size-4" />
					Add block
				</Button>
			))}
		</>
	);
}
