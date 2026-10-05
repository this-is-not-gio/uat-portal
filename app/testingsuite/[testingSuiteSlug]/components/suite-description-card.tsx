"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Info } from "lucide-react";
import { MarkdownEditor } from "@/components/markdown-editor";

// Overview "Description". The card renders nothing when there's no description;
// the editor shows in the Overview's edit mode (SuiteOverviewContent).
export function SuiteDescriptionCard({ description }: { description: string }) {
	if (!description.trim()) return null;
	return (
		<div className="flex flex-col gap-1 border rounded-md">
			<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
				<Info className="text-accent-foreground size-4" />
				<p className="font-semibold">Description</p>
			</div>
			<div className="p-4 typeset text-sm">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
			</div>
		</div>
	);
}

export function SuiteDescriptionEditor({ draft, onDraftChange, disabled }: { draft: string; onDraftChange: (value: string) => void; disabled?: boolean }) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1 w-full">
				<div className="flex flex-row gap-2 items-center">
					<Info className="text-accent-foreground size-4" />
					<p className="font-semibold">Description</p>
				</div>
				<p className="text-xs text-muted-foreground">Add Description for this test suite.</p>
			</div>
			<MarkdownEditor value={draft} onChange={onDraftChange} placeholder="What does this test suite cover?" disabled={disabled} />
		</div>
	);
}
