"use client";

import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Heading1, Heading2, Heading3, Italic, List, ListCheck, ListOrdered, Quote, Strikethrough, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TOOLBAR_GROUPS: { name: string; items: { label: string; Icon: LucideIcon; before: string; after: string }[] }[] = [
	{
		name: "Headings",
		items: [
			{ label: "Heading 1", Icon: Heading1, before: "# ", after: "" },
			{ label: "Heading 2", Icon: Heading2, before: "## ", after: "" },
			{ label: "Heading 3", Icon: Heading3, before: "### ", after: "" },
		],
	},
	{
		name: "Text Formatting",
		items: [
			{ label: "Bold", Icon: Bold, before: "**", after: "**" },
			{ label: "Italic", Icon: Italic, before: "_", after: "_" },
			{ label: "Strikethrough", Icon: Strikethrough, before: "~~", after: "~~" },
			{ label: "Code", Icon: Code, before: "`", after: "`" },
			{ label: "BlockQuote", Icon: Quote, before: "> ", after: "" },
		],
	},
	{
		name: "Lists",
		items: [
			{ label: "Unordered List", Icon: List, before: "- ", after: "" },
			{ label: "Ordered List", Icon: ListOrdered, before: "1. ", after: "" },
			{ label: "Task List", Icon: ListCheck, before: "- [ ] ", after: "" },
		],
	},
];

// Controlled Markdown field with a formatting toolbar and Write/Preview tabs.
// `actions` renders on the right of the footer (Cancel/Save etc.).
export function MarkdownEditor({
	value,
	onChange,
	placeholder,
	disabled,
	actions,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	actions?: ReactNode;
}) {
	const [tab, setTab] = useState<"write" | "preview">("write");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	function wrapSelection(before: string, after: string) {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const { selectionStart, selectionEnd } = textarea;
		const selected = value.slice(selectionStart, selectionEnd);
		onChange(value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd));
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
		});
	}

	return (
		<div className="flex rounded-lg border gap-0">
			<Tabs value={tab} onValueChange={(next) => setTab(next as "write" | "preview")} className="w-full gap-0">
				<div className="flex items-center gap-3 border-b p-2 bg-accent/50">
					{TOOLBAR_GROUPS.map((group) => (
						<ButtonGroup key={group.name} className="bg-white">
							{group.items.map((action) => (
								<Tooltip key={action.label}>
									<TooltipTrigger render={
										<Button
											type="button"
											variant="outline"
											size="icon-sm"
											aria-label={action.label}
											onClick={() => wrapSelection(action.before, action.after)}
											disabled={disabled || tab === "preview"}
										>
											<action.Icon className="h-3.5 w-3.5" />
										</Button>
									} />
									<TooltipContent side="bottom" className="w-auto">
										<p className="text-xs">{action.label}</p>
									</TooltipContent>
								</Tooltip>
							))}
						</ButtonGroup>
					))}
				</div>
				<TabsContent value="write" className="mt-0">
					<Textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={placeholder}
						className="min-h-40 resize-y rounded-none border-0 shadow-none focus-visible:ring-0 p-4 text-xs md:text-sm"
						disabled={disabled}
					/>
				</TabsContent>
				<TabsContent value="preview" className="mt-0 min-h-40 p-4">
					{value.trim() ? (
						<div className="typeset text-sm">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">Nothing to preview.</p>
					)}
				</TabsContent>
				<div className="flex items-center justify-between border-t p-4">
					<TabsList>
						<TabsTrigger value="write" className="text-sm">Write</TabsTrigger>
						<TabsTrigger value="preview" className="text-sm">Preview</TabsTrigger>
					</TabsList>
					<div className="flex flex-row items-center gap-2">{actions}</div>
				</div>
			</Tabs>
		</div>
	);
}
