"use client";

import { useState, useTransition } from "react";
import { Bug, Link2, Plus, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { MarkdownEditor } from "@/components/markdown-editor";
import { RemarkAttachments } from "@/components/testcasesheet/remark-attachments";
import { createDefect } from "@/lib/supabase/defect-actions";
import { DEFECT_SEVERITIES, jiraUrlError } from "@/lib/supabase/defect-format";
import type { defectSeverity } from "@/lib/supabase/defects";
import type { signedAttachment } from "@/lib/supabase/attachment-actions";
import type { testRemark } from "@/lib/supabase/test-cases";

// Splits a remark into its text and the evidence links RemarkMarkdownField appends under "**Evidence:**"
// (create_defect saves the same split, 0080).
function splitEvidence(remark: string) {
	const index = remark.search(/\*\*Evidence:\*\*/);
	if (index < 0) return { text: remark.trim(), links: [] };
	const links = [...remark.slice(index).matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({ label: m[1], url: m[2] }));
	return { text: remark.slice(0, index).trim(), links };
}

// A remark that can be cited by a defect on this case: a step remark (label "Step 2") or overall feedback (stepText null).
export type defectCandidate = {
	remark: testRemark;
	label: string;
	stepText: string | null;
	files: signedAttachment[];
};

function ReferenceBlock({ candidate, onRemove }: { candidate: defectCandidate; onRemove?: () => void }) {
	const { text, links } = splitEvidence(candidate.remark.remark);
	return (
		<div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
			<div className="flex flex-row items-start justify-between gap-2">
				<p className="text-sm"><span className="font-semibold">{candidate.label}:</span> {candidate.stepText ?? "Overall feedback on this test case"}</p>
				{onRemove && (
					<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={onRemove} aria-label={`Remove ${candidate.label} remark`}>
						<X className="size-3.5" />
					</Button>
				)}
			</div>
			{text && (
				<div className="typeset text-sm break-words border-l-2 pl-3">
					<ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{text}</ReactMarkdown>
				</div>
			)}
			{links.length > 0 && (
				<ul className="flex flex-col gap-1">
					{links.map((link) => (
						<li key={link.url}>
							<a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
								<Link2 className="size-3" />
								{link.label}
							</a>
						</li>
					))}
				</ul>
			)}
			<RemarkAttachments attachments={candidate.files} />
		</div>
	);
}

// Logs a defect from a remark on a failed step or the overall feedback of a failed case. The source remark
// is always cited; other remarks of the same case (candidates) can be added or removed.
export function CreateDefectDialog({ caseResultId, source, candidates }: {
	caseResultId: string;
	source: defectCandidate;
	candidates: defectCandidate[];
}) {
	const [open, setOpen] = useState(false);
	const [summary, setSummary] = useState("");
	const [description, setDescription] = useState("");
	const [severity, setSeverity] = useState<defectSeverity>("medium");
	const [jiraUrl, setJiraUrl] = useState("");
	const [jiraTouched, setJiraTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [extraIds, setExtraIds] = useState<string[]>([]);
	const cited = [source, ...candidates.filter((c) => extraIds.includes(c.remark.id) && c.remark.id !== source.remark.id)];
	const addable = candidates.filter((c) => c.remark.id !== source.remark.id && !extraIds.includes(c.remark.id));
	const jiraError = jiraUrlError(jiraUrl);

	function reset() {
		setExtraIds([]);
		setSummary("");
		setDescription("");
		setSeverity("medium");
		setJiraUrl("");
		setJiraTouched(false);
		setError(null);
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await createDefect({ caseResultId, remarkIds: cited.map((c) => c.remark.id), summary, description, severity, jiraUrl });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			toast.success(`${result.data.code} logged`);
			reset();
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
			<DialogTrigger render={<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
				<Bug className="size-3.5" />
				Create defect
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Bug className="size-4" />
						Create defect
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Logged against this round. Staff only; clients don&apos;t see defects.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					<div className="flex flex-col gap-2">
						<p className="text-xs font-medium text-muted-foreground">Reference{cited.length > 1 ? "s" : ""}</p>
						{cited.map((c) => (
							<ReferenceBlock key={c.remark.id} candidate={c} onRemove={c.remark.id === source.remark.id || isPending ? undefined : () => setExtraIds((ids) => ids.filter((id) => id !== c.remark.id))} />
						))}
					</div>
					{addable.length > 0 && (
						<div className="flex flex-col gap-1">
							<p className="text-xs font-medium text-muted-foreground">Add other remarks from this test case</p>
							<ul className="flex flex-col gap-1">
								{addable.map((c) => (
									<li key={c.remark.id} className="flex flex-row items-center justify-between gap-2 rounded-md border px-2 py-1">
										<p className="min-w-0 truncate text-xs"><span className="font-semibold">{c.label}:</span> {splitEvidence(c.remark.remark).text || "(evidence only)"}</p>
										<Button variant="outline" size="sm" className="h-6 shrink-0 gap-1 px-2 text-xs" disabled={isPending} onClick={() => setExtraIds((ids) => [...ids, c.remark.id])}>
											<Plus className="size-3" />
											Add
										</Button>
									</li>
								))}
							</ul>
						</div>
					)}
					<div className="flex flex-col gap-1">
						<Label htmlFor="defect-summary" className="text-xs text-muted-foreground flex flex-row justify-between">
							<span>Summary</span>
							<span className="text-destructive text-xs">*</span>
						</Label>
						<Input id="defect-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} disabled={isPending} placeholder="e.g. Save button does nothing on the profile page" />
					</div>
					<div className="flex flex-col gap-1">
						<Label className="text-xs text-muted-foreground">Description</Label>
						<MarkdownEditor value={description} onChange={setDescription} placeholder="Steps, expected vs actual, notes" disabled={isPending} />
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label className="text-xs text-muted-foreground">Severity</Label>
							<Select value={severity} onValueChange={(value) => value && setSeverity(value as defectSeverity)} disabled={isPending}>
								<SelectTrigger className="w-full">
									<SelectValue>{DEFECT_SEVERITIES.find((s) => s.value === severity)?.label}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{DEFECT_SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="defect-jira" className="text-xs text-muted-foreground">Jira link</Label>
							<Input id="defect-jira" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} onBlur={() => setJiraTouched(true)} disabled={isPending} placeholder="https://yourteam.atlassian.net/browse/ABC-123" aria-invalid={jiraTouched && !!jiraError} />
							{jiraTouched && jiraError && <p className="text-xs text-destructive">{jiraError}</p>}
						</div>
					</div>
					{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Cancel
					</DialogClose>
					<Button onClick={onSave} disabled={isPending || !summary.trim() || !!jiraError}>
						<Bug className="size-4" />
						{isPending ? "Saving…" : "Create defect"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
