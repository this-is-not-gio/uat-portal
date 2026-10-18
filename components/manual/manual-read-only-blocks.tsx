import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Callout } from "@/components/manual/doc-parts";
import { BLOCK_ICONS, toTableData } from "@/lib/manual/blocks";
import type { manualBlock } from "@/lib/supabase/manual";

const H2 = "border-b pb-2 text-xl font-semibold tracking-tight mb-4 mt-10";

export function BlockContent({ block }: { block: manualBlock }) {
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

// The blocks of a page with no editing: no edit or draft providers needed, so it can sit
// outside /manual (e.g. a suite's Manual tab). Renders each block exactly as /manual does.
export function ReadOnlyBlockList({ blocks, anchors }: { blocks: manualBlock[]; anchors: string[] }) {
	return (
		<>
			{blocks.map((block, i) => (
				<section key={block.id} id={anchors[i]} className="scroll-mt-8 space-y-3">
					<BlockContent block={block} />
				</section>
			))}
		</>
	);
}
