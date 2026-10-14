"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpDown, Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/confirm-dialog";
import { Callout } from "@/components/manual/doc-parts";
import { BlockBodyFields } from "@/components/manual/block-fields";
import { useManualContentEditing, useManualDraft, type newBlockDraft } from "@/components/manual/manual-edit";
import { ManualOrderedSortable, ManualSortableRow } from "@/components/manual/manual-sortable";
import { BLOCK_ICONS, BLOCK_TYPES, toTableData, type blockType } from "@/lib/manual/blocks";
import { deleteManualBlock } from "@/lib/supabase/manual-actions";
import type { manualBlock, manualBlockContainer } from "@/lib/supabase/manual";

const H2 = "border-b pb-2 text-xl font-semibold tracking-tight mb-4 mt-10";

// A block added in edit mode: pick its type, then fill the fields for it. Saved with the page.
function NewBlockEditor({ block }: { block: newBlockDraft }) {
	const draft = useManualDraft();

	return (
		<section className="space-y-1">
			<div className="flex flex-row items-center justify-between gap-2">
				<div className="flex items-center gap-1">
					<p className="text-xs font-medium text-muted-foreground">
						{BLOCK_TYPES.find((t) => t.value === block.blockType)?.label} Content
					</p>
				</div>
				<Button type="button" variant="ghost" size="icon-sm" aria-label="Remove block" onClick={() => draft.removeNewBlock(block.key)}>
					<X className="size-3.5" />
				</Button>
			</div>
			<BlockBodyFields
				type={block.blockType}
				header={block.header}
				body={block.body}
				data={block.data}
				onChange={(patch) => draft.setNewBlock(block.key, patch)}
			/>
		</section>
	);
}

function BlockContent({ block }: { block: manualBlock }) {
	if (block.blockType === "icon") {
		const Icon = BLOCK_ICONS[block.data.icon ?? ""]?.icon ?? BLOCK_ICONS.info.icon;
		return <Callout icon={Icon} title={block.data.title ?? block.header}>{block.body}</Callout>;
	}
	if (block.blockType === "header") return <h2 className={H2}>{block.header}</h2>;

	const { columns, rows } = toTableData(block.data);
	return (
		<>
			{block.blockType === "table" && columns.length > 0 && (
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-left text-sm">
						<thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
							<tr>
								{columns.map((column, c) => <th key={c} className="px-4 py-2 font-medium">{column}</th>)}
							</tr>
						</thead>
						<tbody className="divide-y">
							{rows.map((row, r) => (
								<tr key={r}>
									{row.map((cell, c) => (
										<td key={c} className={c === 0 ? "px-4 py-2 font-mono text-xs" : "px-4 py-2 text-muted-foreground"}>{cell}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{block.blockType === "content" && block.body.trim() && (
				<pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-6">{block.body}</pre>
			)}
			{block.blockType === "general" && block.body.trim() && (
				<div className="typeset text-sm my-2">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{block.body}</ReactMarkdown>
				</div>
			)}
		</>
	);
}

function BlockView({ block, anchor }: { block: manualBlock; anchor: string }) {
	const editing = useManualContentEditing();
	const draft = useManualDraft();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const deleteDialog = (
		<ConfirmDialog
			open={deleteOpen}
			onOpenChange={setDeleteOpen}
			title={`Delete "${block.header}"?`}
			description="This block and its content will be removed from the manual."
			confirmLabel="Delete block"
			onConfirm={() => deleteManualBlock({ id: block.id })}
		/>
	);

	if (editing) {
		const saved = draft.blockDraft(block);
		// Callouts saved before they had their own title field keep it in the header.
		const value = block.blockType === "icon" && saved.data.title === undefined ? { ...saved, data: { ...saved.data, title: block.header } } : saved;
		return (
			<section id={anchor} className="scroll-mt-8 space-y-1">
				<div className="flex flex-row items-center justify-between gap-2">
					<div className="flex items-center gap-1">
						<p className="text-xs font-medium text-muted-foreground">
							{BLOCK_TYPES.find((t) => t.value === block.blockType)?.label} Content
						</p>
					</div>
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Delete block" onClick={() => setDeleteOpen(true)}>
						<X className="size-3.5" />
					</Button>
				</div>
				<BlockBodyFields
					type={block.blockType}
					header={value.header}
					body={value.body}
					data={value.data}
					onChange={(patch) => draft.setBlockDraft(block.id, patch)}
				/>
				{deleteDialog}
			</section>
		);
	}

	return (
		<section id={anchor} className="scroll-mt-8 space-y-3">
			<BlockContent block={block} />
		</section>
	);
}

// One line per block for Reorder mode: full forms are too tall to drag past each other.
function BlockSummary({ type, label, handle }: { type: blockType; label: string; handle: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 shadow-xs">
			{handle}
			<span className="shrink-0 rounded bg-muted px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				{BLOCK_TYPES.find((t) => t.value === type)?.label}
			</span>
			<span className={label ? "truncate text-sm" : "truncate text-sm italic text-muted-foreground"}>{label || "Untitled"}</span>
		</div>
	);
}

// What a block is called in Reorder mode: its header, a callout's title, or the start of its body.
function summaryLabel(header: string, body: string, title?: string) {
	return (title ?? "").trim() || header.trim() || body.trim().split("\n")[0].slice(0, 80);
}

// The blocks of one module or section page. `container` says where new blocks go,
// so the section pages can reuse this as-is. While editing, "Reorder" swaps the forms for
// one-line cards that can be dragged; the new order is saved with the rest of the page.
export function ManualBlockList({
	blocks,
	anchors,
}: {
	container: manualBlockContainer;
	blocks: manualBlock[];
	anchors: string[];
}) {
	const editing = useManualContentEditing();
	const draft = useManualDraft();
	// Reset by the draft provider remounting the page whenever editing starts or ends.
	const [reordering, setReordering] = useState(false);
	const sorting = editing && reordering;
	// Anchors follow the saved order; keyed by id so they stay put while a drag is in flight.
	const anchorById = new Map(blocks.map((block, i) => [block.id, anchors[i]]));

	const savedById = new Map(blocks.map((block) => [block.id, block]));
	const newByKey = new Map(draft.newBlocks.map((block) => [block.key, block]));

	const summary = (id: string, handle: React.ReactNode) => {
		const saved = savedById.get(id);
		if (saved) {
			const value = draft.blockDraft(saved);
			return <BlockSummary type={saved.blockType} label={summaryLabel(value.header, value.body, value.data.title)} handle={handle} />;
		}
		const added = newByKey.get(id);
		return added && <BlockSummary type={added.blockType} label={summaryLabel(added.header, added.body, added.data.title)} handle={handle} />;
	};

	return (
		<>
			{editing && draft.orderedIds.length > 1 && (
				<div className="flex items-center justify-between gap-2">
					<p className="text-xs text-muted-foreground">
						{sorting ? "Drag the blocks into order, then press Done. The order is saved with the page." : `${draft.orderedIds.length} content blocks`}
					</p>
					<Button type="button" variant={sorting ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setReordering(!sorting)}>
						{sorting ? <Check className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
						{sorting ? "Done" : "Reorder"}
					</Button>
				</div>
			)}
			<div className={sorting ? "space-y-1.5" : editing ? "space-y-10" : undefined}>
				<ManualOrderedSortable ids={draft.orderedIds} onMove={draft.moveBlock}>
					{draft.orderedIds.map((id) => (
						<ManualSortableRow key={id} id={id} editing={sorting}>
							{({ setNodeRef, style, handle }) => (
								<div ref={setNodeRef} style={style}>
									{sorting
										? summary(id, handle)
										: savedById.has(id)
											? <BlockView block={savedById.get(id)!} anchor={anchorById.get(id)!} />
											: newByKey.has(id) && <NewBlockEditor block={newByKey.get(id)!} />}
								</div>
							)}
						</ManualSortableRow>
					))}
				</ManualOrderedSortable>
			</div>
			{editing && !sorting && (
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">Add content</p>
					<div className="flex flex-row flex-wrap gap-2">
						{BLOCK_TYPES.map((t) => (
							<Button key={t.value} type="button" variant="outline" size="sm" onClick={() => draft.addNewBlock(t.value)}>
								<Plus className="size-4" />
								{t.label}
							</Button>
						))}
					</div>
				</div>
			)}
		</>
	);
}
