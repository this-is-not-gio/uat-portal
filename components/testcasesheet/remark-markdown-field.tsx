"use client";

import { useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Heading1, Heading2, Heading3, Italic, Link2, List, ListCheck, ListOrdered, Quote, Send, Strikethrough, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
} from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { group } from "console";
import { addStepRemark } from "@/lib/supabase/action";
import { testRemark, testStep } from "@/lib/supabase/test-cases";

const TOOLBAR_ACTIONS: {
	name: string;
	items: {
		label: string;
		Icon: LucideIcon;
		before: string;
		after: string;
	}[]
}[] = [
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
		}
	];

export function RemarkMarkdownField({
	PIC,
	step,
	placeholder = "Leave a remark the tested step",
	onSubmitted
}: {
	PIC: string;
	step: testStep
	placeholder?: string;
	onSubmitted: (remark: testRemark) => void;
}): import("react").JSX.Element {
	const [draftText, setDraftText] = useState<string>("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEmpty = !draftText.trim();

	function wrapSelection(before: string, after: string) {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const { selectionStart, selectionEnd } = textarea;
		const selected = draftText.slice(selectionStart, selectionEnd);
		const next =
			draftText.slice(0, selectionStart) + before + selected + after + draftText.slice(selectionEnd);
		setDraftText(next);
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(
				selectionStart + before.length,
				selectionStart + before.length + selected.length,
			);
		});
	}

	const [tab, setTab] = useState<"write" | "preview">("write");
	const [isPending, startTransition] = useTransition();
	const onSubmit = () => {
		const text = draftText.trim();
		if (!text) return;

		startTransition(async () => {
			try {
				const insertedRemark = await addStepRemark({
					stepId: step.id, // Replace with actual step ID
					remark: text,
					createdBy: PIC, // Replace with actual user ID
				});

				onSubmitted({
					id: insertedRemark.id,
					remark: insertedRemark.remark,
					author: {
						id: insertedRemark?.profile?.id || "unknown",
						full_name: insertedRemark?.profile?.full_name || "Unknown",
						role: insertedRemark?.profile?.role || "External",
					},
					created_at: insertedRemark.created_at,
				})
			} catch (error) {
				console.error("Error adding remark:", error);
			} finally {
				setDraftText("");
			}
		})

	}

	return (
		<div className="flex rounded-lg border gap-0">
			<Tabs value={tab} onValueChange={(value) => setTab(value as "write" | "preview")} className="w-full gap-0">
				<div className="flex items-center justify-between border-b p-2 bg-accent/50">
					{
						TOOLBAR_ACTIONS.find(group => group.name === "Headings") &&
						<Select>
							<SelectTrigger className="w-50 text-xs bg-white">
								<SelectValue placeholder="Headings" />
							</SelectTrigger>
							<SelectContent>
								{TOOLBAR_ACTIONS.find(group => group.name === "Headings")?.items.map((action) => (
									<SelectItem
										key={action.label}
										value={action.label}
										onClick={() => wrapSelection(action.before, action.after)}
										disabled={isPending || isEmpty}
									>
										<div className="flex items-center gap-2">
											<action.Icon className="h-3.5 w-3.5" />
											<p>{action.label}</p>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
					<div className="flex items-center gap-3 justify-center">
						{TOOLBAR_ACTIONS.map((group) => {
							const isHeadingGroup = group.name === "Headings";
							return isHeadingGroup ?
								null
								:
								<ButtonGroup key={group.name} className="bg-white">
									{
										group.items.map((action, index) => (
											<Tooltip key={action.label}>
												<TooltipTrigger render={
													<Button
														key={action.label}
														type="button"
														variant="outline"
														size="icon-sm"
														title={action.label}
														onClick={() => wrapSelection(action.before, action.after)}
														disabled={isPending}
													>
														<action.Icon className="h-3.5 w-3.5" />
													</Button>
												} />
												<TooltipContent side="bottom" className="w-auto">
													<p className="text-xs">{action.label}</p>
												</TooltipContent>
											</Tooltip>
										))
									}
								</ButtonGroup>

						})}

					</div>
				</div>
				<TabsContent value="write" className="mt-0">
					<Textarea
						ref={textareaRef}
						value={draftText}
						onChange={(e) => setDraftText(e.target.value)}
						placeholder={placeholder}
						className="min-h-24 resize-none rounded-none border-0 shadow-none focus-visible:ring-0 p-4"
						disabled={isPending}
					/>
				</TabsContent>
				<TabsContent value="preview" className="mt-0 min-h-24 p-4">
					{isEmpty ? (
						<p className="text-sm text-muted-foreground">Nothing to preview.</p>
					) : (
						<div className="typeset text-sm">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{draftText}</ReactMarkdown>
						</div>
					)}
				</TabsContent>

				<div className="flex items-center justify-between border-t p-4">
					<TabsList>
						<TabsTrigger value="write" className="text-sm">Write</TabsTrigger>
						<TabsTrigger value="preview" className="text-sm">Preview</TabsTrigger>
					</TabsList>

					<div className="flex flex-row items-center gap-2">
						<Button type="button" variant="default" disabled={isEmpty || isPending} onClick={onSubmit} className="flex items-center gap-1 p-4">
							<Send size={16} className="ml-1" />
							<p>Add Remark</p>
						</Button>
					</div>
				</div>
			</Tabs>
		</div>
	);
}

