"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LayoutList, Plus, Trash2 } from "lucide-react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkdownEditor } from "@/components/markdown-editor";
import type { suiteOverviewSection } from "@/lib/supabase/test-accounts";

export type sectionDraft = { key: string; title: string; icon: string; content: string };
export const emptySection = (): sectionDraft => ({ key: crypto.randomUUID(), title: "", icon: "", content: "" });

// Accepts Lucide's kebab-case ("triangle-alert") or the React name ("TriangleAlert").
export function toIconName(value: string | null): IconName | null {
	if (!value) return null;
	const name = value.trim().replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
	return (iconNames as string[]).includes(name) ? (name as IconName) : null;
}

function SectionIcon({ icon }: { icon: string | null }) {
	const name = toIconName(icon);
	return name ? <DynamicIcon name={name} className="text-accent-foreground size-4" /> : <LayoutList className="text-accent-foreground size-4" />;
}

// Overview custom sections: one card per section; nothing when there are none.
export function SuiteCustomSectionCards({ sections }: { sections: suiteOverviewSection[] }) {
	return sections.map((section) => (
		<div key={section.id} className="flex flex-col gap-1 border rounded-md">
			<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
				<SectionIcon icon={section.icon} />
				<p className="font-semibold">{section.title}</p>
			</div>
			{section.content.trim() && (
				<div className="p-4 typeset text-sm">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
				</div>
			)}
		</div>
	));
}

export function SuiteCustomSectionsEditor({ sections, onSectionsChange, disabled }: { sections: sectionDraft[]; onSectionsChange: (sections: sectionDraft[]) => void; disabled?: boolean }) {
	function updateSection(key: string, patch: Partial<sectionDraft>) {
		onSectionsChange(sections.map((section) => (section.key === key ? { ...section, ...patch } : section)));
	}
	const addButton = (
		<Button type="button" variant="outline" className="text-xs flex flex-row gap-2 items-center w-fit" disabled={disabled} onClick={() => onSectionsChange([...sections, emptySection()])}>
			<Plus className="size-4" />
			<p>Add Custom Section</p>
		</Button>
	);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col w-full">
				<div className="flex flex-row gap-2 items-center">
					<LayoutList className="text-accent-foreground size-4" />
					<p className="font-semibold">Custom Sections</p>
				</div>
				<p className="text-xs text-muted-foreground">Add your own sections, e.g. Testing Guidelines.</p>
			</div>
			{sections.map((section) => (
				<div key={section.key} className="flex flex-col gap-3 border rounded-md p-4">
					<div className="flex flex-row gap-4 items-start">
						<Field className="w-64">
							<div className="flex flex-row gap-2 items-center justify-between">
								<FieldLabel htmlFor={`section-icon-${section.key}`} className="text-xs font-medium text-muted-foreground">Icon</FieldLabel>
								<FieldDescription className="text-xs">
									{section.icon.trim() && !toIconName(section.icon)
										? "Not a Lucide icon name."
										: <>Any name from <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer" className="underline">lucide.dev/icons</a></>}
								</FieldDescription>
							</div>
							<div className="flex flex-row gap-2 items-center">
								<div className="size-9 shrink-0 rounded-md bg-accent flex items-center justify-center"><SectionIcon icon={section.icon} /></div>
								<Input id={`section-icon-${section.key}`} className="font-mono" placeholder="signpost" autoComplete="off" disabled={disabled} value={section.icon} onChange={(e) => updateSection(section.key, { icon: e.target.value })} />
							</div>
						</Field>
						<Field className="flex-1">
							<FieldLabel htmlFor={`section-title-${section.key}`} className="text-xs font-medium text-muted-foreground">Header</FieldLabel>
							<Input id={`section-title-${section.key}`} placeholder="e.g. Testing Guidelines" disabled={disabled} value={section.title} onChange={(e) => updateSection(section.key, { title: e.target.value })} />
						</Field>
						<Button type="button" size="icon" variant="ghost" aria-label="Remove section" className="mt-6 text-destructive hover:text-destructive" disabled={disabled} onClick={() => onSectionsChange(sections.filter((s) => s.key !== section.key))}>
							<Trash2 className="size-4" />
						</Button>
					</div>
					<MarkdownEditor value={section.content} onChange={(content) => updateSection(section.key, { content })} placeholder="Section content" disabled={disabled} />
				</div>
			))}
			{sections.length === 0 ? (
				<div className="flex flex-col items-center gap-3 border border-dashed rounded-md py-6">
					<EmptyState icon={LayoutList} size="sm" title="No custom sections yet" description="Add sections like Testing Guidelines or Things NOT to do." />
					{addButton}
				</div>
			) : addButton}
		</div>
	);
}
