"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Italic, Link2, Send, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TOOLBAR_ACTIONS: {
	label: string;
	Icon: LucideIcon;
	before: string;
	after: string;
}[] = [
	{ label: "Bold", Icon: Bold, before: "**", after: "**" },
	{ label: "Italic", Icon: Italic, before: "_", after: "_" },
	{ label: "Code", Icon: Code, before: "`", after: "`" },
	{ label: "Link", Icon: Link2, before: "[", after: "](url)" },
];

export function RemarkMarkdownField({
	value,
	onChange,
	onSubmit,
	onCancel,
	placeholder = "Leave a remark the tested step",
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
	placeholder?: string;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEmpty = !value.trim();

	function wrapSelection(before: string, after: string) {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const { selectionStart, selectionEnd } = textarea;
		const selected = value.slice(selectionStart, selectionEnd);
		const next =
			value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
		onChange(next);
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(
				selectionStart + before.length,
				selectionStart + before.length + selected.length,
			);
		});
	}

	return (
		<div className="rounded-lg border">
			<Tabs defaultValue="write">
				<div className="flex items-center justify-between border-b p-2">
					<TabsList>
						<TabsTrigger value="write">Write</TabsTrigger>
						<TabsTrigger value="preview">Preview</TabsTrigger>
					</TabsList>
					<div className="flex items-center gap-0.5">
						{TOOLBAR_ACTIONS.map((action) => (
							<Button
								key={action.label}
								type="button"
								variant="ghost"
								size="icon-sm"
								title={action.label}
								onClick={() => wrapSelection(action.before, action.after)}
							>
								<action.Icon className="h-3.5 w-3.5" />
							</Button>
						))}
					</div>
				</div>
				<TabsContent value="write" className="mt-0">
					<Textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={placeholder}
						className="min-h-24 resize-none rounded-none border-0 shadow-none focus-visible:ring-0"
					/>
				</TabsContent>
				<TabsContent value="preview" className="mt-0 min-h-24 px-3 py-2">
					{isEmpty ? (
						<p className="text-sm text-muted-foreground">Nothing to preview.</p>
					) : (
						<div className="typeset text-sm">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
						</div>
					)}
				</TabsContent>
			</Tabs>
			<div className="flex items-center justify-end gap-2 border-t p-2">
				<Button type="button" variant="ghost" disabled={isEmpty} onClick={onCancel} className="flex items-center gap-1 p-4">
					Cancel
				</Button>
				<Button type="button" variant="default" disabled={isEmpty} onClick={onSubmit} className="flex items-center gap-1 p-4">
					<Send size={16} className="ml-1" />
					<p>Add Remark</p>
				</Button>
			</div>
		</div>
	);
}
