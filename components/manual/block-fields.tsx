"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/markdown-editor";
import { BLOCK_ICONS, toTableData, type blockData, type blockType, type tableData } from "@/lib/manual/blocks";
import { TooltipTrigger, Tooltip, TooltipContent } from "../ui/tooltip";

export const headerPlaceholder = (type: blockType) =>
	type === "header" ? "Header" : "Block header";

function TableEditor({ value, onChange, disabled }: { value: tableData; onChange: (value: tableData) => void; disabled?: boolean }) {
	const setColumn = (c: number, text: string) => onChange({ ...value, columns: value.columns.map((col, i) => (i === c ? text : col)) });
	const setCell = (r: number, c: number, text: string) =>
		onChange({ ...value, rows: value.rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? text : cell)) : row)) });
	const addColumn = () => onChange({ columns: [...value.columns, `Column ${value.columns.length + 1}`], rows: value.rows.map((row) => [...row, ""]) });
	const removeColumn = (c: number) => onChange({ columns: value.columns.filter((_, i) => i !== c), rows: value.rows.map((row) => row.filter((_, j) => j !== c)) });
	const addRow = () => onChange({ ...value, rows: [...value.rows, value.columns.map(() => "")] });
	const removeRow = (r: number) => onChange({ ...value, rows: value.rows.filter((_, i) => i !== r) });

	return (
		<div className="space-y-2">
			<div className="space-y-2 overflow-x-auto">
				<div className="flex items-end gap-2">
					{value.columns.map((column, c) => (
						<div key={c} className="flex flex-col min-w-32 flex-1 gap-1">
							<div className="flex flex-row flex-1 items-center gap-2 justify-between">
								<p className="text-xs text-muted-foreground">Column {c + 1}</p>
								{
									value.columns.length > 1 &&
									<Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove column ${c + 1}`} onClick={() => removeColumn(c)} disabled={disabled || value.columns.length <= 1}>
										<X className="size-3.5" />
									</Button>
								}
							</div>
							<Input value={column} onChange={(e) => setColumn(c, e.target.value)} disabled={disabled} placeholder="Column name" aria-label={`Column ${c + 1} name`} className="font-medium" />
						</div>
					))}
					{/*  */}
					<Tooltip>
						<TooltipTrigger render={
							<Button type="button" variant="outline" size="icon" onClick={addColumn} disabled={disabled}><Plus className="size-4" /></Button>
						} />
						<TooltipContent>
							Add Column
						</TooltipContent>
					</Tooltip>
				</div>
				{value.rows.map((row, r) => (
					<div key={r} className="flex items-center gap-2">
						{row.map((cell, c) => (
							<div key={c} className="min-w-32 flex-1">
								<Input value={cell} onChange={(e) => setCell(r, c, e.target.value)} disabled={disabled} aria-label={`Row ${r + 1}, ${value.columns[c] || `column ${c + 1}`}`} />
							</div>
						))}
						<Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove row ${r + 1}`} onClick={() => removeRow(r)} disabled={disabled || value.rows.length <= 1}>
							<X className="size-3.5" />
						</Button>
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<Button className="flex items-center gap-2 w-full" type="button" variant="outline" size="lg" onClick={addRow} disabled={disabled}><Plus className="size-4" />Add row</Button>
			</div>
		</div>
	);
}

// The fields of a block; they change with the block type. A header block's only field is its header.
export function BlockBodyFields({
	type,
	header,
	body,
	data,
	onChange,
	disabled,
}: {
	type: blockType;
	header: string;
	body: string;
	data: blockData;
	onChange: (patch: { header?: string; body?: string; data?: blockData }) => void;
	disabled?: boolean;
}) {
	if (type === "header") {
		return (
			<div className="flex flex-col gap-1 w-full">
				<p className="text-xs text-muted-foreground">Header</p>
				<Input
					value={header}
					onChange={(e) => onChange({ header: e.target.value })}
					disabled={disabled}
					placeholder="Header"
					aria-label="Header"
				/>
			</div>
		);
	}

	if (type === "icon") {
		const icon = data.icon && BLOCK_ICONS[data.icon] ? data.icon : "info";
		return (
			<div className="space-y-3">
				<div className="flex flex-row gap-2 items-center">
					<div className="flex flex-col gap-1">
						<p className="text-xs text-muted-foreground">Call Out Type</p>
						<Select value={icon} onValueChange={(value) => onChange({ data: { ...data, icon: value as string } })} disabled={disabled}>
							<SelectTrigger className="w-40" aria-label="Icon">
								<SelectValue>{BLOCK_ICONS[icon].label}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								{Object.entries(BLOCK_ICONS).map(([key, { label, icon: Icon }]) => (
									<SelectItem key={key} value={key}><Icon className="size-4" />{label}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1 w-full">
						<p className="text-xs text-muted-foreground">Callout title</p>
						<Input
							value={data.title ?? ""}
							onChange={(e) => onChange({ data: { ...data, title: e.target.value } })}
							disabled={disabled}
							placeholder="Callout title"
							aria-label="Callout title"
						/>
					</div>
				</div>
				<Textarea value={body} onChange={(e) => onChange({ body: e.target.value })} disabled={disabled} placeholder="Callout text" aria-label="Callout text" rows={3} />
			</div>
		);
	}

	if (type === "table") {
		return <TableEditor value={toTableData(data)} onChange={(table) => onChange({ data: { ...data, ...table } })} disabled={disabled} />;
	}

	if (type === "content") {
		return (
			<Textarea
				value={body}
				onChange={(e) => onChange({ body: e.target.value })}
				disabled={disabled}
				placeholder="Preformatted text, shown exactly as typed"
				aria-label="Content"
				rows={6}
				className="font-mono text-xs"
			/>
		);
	}

	return <MarkdownEditor value={body} onChange={(value) => onChange({ body: value })} disabled={disabled} preview={false} placeholder="Write the block content in Markdown…" />;
}
