"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowDown, ArrowUp, FilePlus2, LayoutDashboard, PencilIcon, PlusIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MarkdownEditor } from "@/components/markdown-editor";
import { saveSignOffSections } from "@/lib/supabase/iteration-actions";
import { SECTION_LIMITS, sectionProblem, type OverviewTemplate, type ReportSection } from "@/lib/report/report-details";

// One vendor section as it reads in the report: a label like "Participants" over its Markdown.
// Also used by the issued (read-only) report.
export function ReportSectionContent({ section }: { section: Pick<ReportSection, "title" | "markdown"> }) {
	return (
		<div className="flex flex-col gap-2 print:break-inside-avoid">
			<p className="text-xs text-muted-foreground">{section.title}</p>
			{section.markdown && (
				// Black body text: typeset reads --color-foreground (stone), which looks grey on the white sheet.
				<div className="typeset text-sm break-words [--color-foreground:var(--color-black)]">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{section.markdown}</ReactMarkdown>
				</div>
			)}
		</div>
	);
}

type editing = { id: string | null; title: string; markdown: string };

// Draft only: the vendor's sections below the participants, with move/edit/remove on hover and an
// Add section menu (blank, or a copy of an Overview card). Every change saves the whole list.
// The controls are screen-only, so print shows the sections as the client will.
export function ReportSectionsEditor({ signOffId, sections, templates }: { signOffId: string; sections: ReportSection[]; templates: OverviewTemplate[] }) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	// The section open in the editor; id null is a new one (appended on save).
	const [editing, setEditing] = useState<editing | null>(null);

	function save(next: ReportSection[], done?: () => void) {
		setError(null);
		startTransition(async () => {
			const result = await saveSignOffSections({ signOffId, sections: next });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			done?.();
		});
	}

	function move(index: number, by: -1 | 1) {
		const next = [...sections];
		[next[index], next[index + by]] = [next[index + by], next[index]];
		save(next);
	}

	function submitEditing() {
		if (!editing) return;
		const section = { title: editing.title.trim(), markdown: editing.markdown.trim() };
		const next = editing.id
			? sections.map((s) => (s.id === editing.id ? { ...s, ...section } : s))
			: [...sections, { id: crypto.randomUUID(), ...section }];
		save(next, () => setEditing(null));
	}

	const editor = editing && (
		<SectionForm editing={editing} pending={isPending} error={error} onChange={setEditing} onCancel={() => { setEditing(null); setError(null); }} onSubmit={submitEditing} />
	);
	const full = sections.length >= SECTION_LIMITS.maxSections;
	const fromOverview = templates.filter((t) => t.markdown || t.key.startsWith("section:"));

	return (
		<div className="flex flex-col gap-6">
			{sections.map((section, i) =>
				editing?.id === section.id ? (
					<div key={section.id}>{editor}</div>
				) : (
					<div key={section.id} className="group relative -mx-2 rounded-md px-2 py-1 hover:bg-muted/40 print:m-0 print:p-0 print:hover:bg-transparent">
						<ReportSectionContent section={section} />
						<div className="absolute top-0 right-1 hidden gap-0.5 rounded-md border bg-background p-0.5 shadow-xs group-hover:flex group-focus-within:flex print:hidden">
							<Button variant="ghost" size="icon-xs" aria-label="Move up" title="Move up" disabled={isPending || i === 0} onClick={() => move(i, -1)}>
								<ArrowUp />
							</Button>
							<Button variant="ghost" size="icon-xs" aria-label="Move down" title="Move down" disabled={isPending || i === sections.length - 1} onClick={() => move(i, 1)}>
								<ArrowDown />
							</Button>
							<Button variant="ghost" size="icon-xs" aria-label={`Edit ${section.title}`} title="Edit" disabled={isPending || !!editing} onClick={() => setEditing({ id: section.id, title: section.title, markdown: section.markdown })}>
								<PencilIcon />
							</Button>
							<Button variant="ghost" size="icon-xs" aria-label={`Remove ${section.title}`} title="Remove" disabled={isPending} onClick={() => save(sections.filter((s) => s.id !== section.id))}>
								<Trash2 />
							</Button>
						</div>
					</div>
				),
			)}

			{editing?.id === null && editor}
			{!editing && error && <p className="text-xs text-destructive print:hidden">{error}</p>}

			{!editing && !full && (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="outline" className="w-full border-dashed text-xs text-muted-foreground print:hidden" disabled={isPending}>
								<PlusIcon />
								Add section
							</Button>
						}
					/>
					<DropdownMenuContent align="center" className="w-64">
						<DropdownMenuGroup>
							<DropdownMenuItem onClick={() => setEditing({ id: null, title: "", markdown: "" })}>
								<FilePlus2 />
								Blank section
							</DropdownMenuItem>
						</DropdownMenuGroup>
						{templates.length > 0 && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
									<DropdownMenuLabel>From Overview</DropdownMenuLabel>
									{templates.map((template) => {
										const empty = !fromOverview.includes(template);
										return (
											<DropdownMenuItem key={template.key} disabled={empty} onClick={() => setEditing({ id: null, title: template.title, markdown: template.markdown })}>
												<LayoutDashboard />
												<span className="flex-1 truncate">{template.label}</span>
												{empty && <span className="text-[11px] text-muted-foreground">Empty</span>}
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuGroup>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

function SectionForm({ editing, pending, error, onChange, onCancel, onSubmit }: { editing: editing; pending: boolean; error: string | null; onChange: (next: editing) => void; onCancel: () => void; onSubmit: () => void }) {
	const problem = sectionProblem(editing);
	return (
		<div className="flex flex-col gap-3 rounded-md border p-3 print:hidden">
			<Input
				aria-label="Section title"
				placeholder="Section title, e.g. Testing guidelines"
				maxLength={SECTION_LIMITS.maxTitle}
				autoFocus
				disabled={pending}
				value={editing.title}
				onChange={(e) => onChange({ ...editing, title: e.target.value })}
			/>
			<MarkdownEditor
				value={editing.markdown}
				onChange={(markdown) => onChange({ ...editing, markdown })}
				placeholder="Write the section in Markdown…"
				disabled={pending}
				actions={
					<div className="flex items-center gap-2">
						{error && <p className="text-xs text-destructive">{error}</p>}
						<Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>Cancel</Button>
						<Button type="button" size="sm" disabled={pending || !!problem} title={problem ? `Section ${problem}` : undefined} onClick={onSubmit}>
							{pending ? "Saving…" : editing.id ? "Save" : "Add section"}
						</Button>
					</div>
				}
			/>
		</div>
	);
}
