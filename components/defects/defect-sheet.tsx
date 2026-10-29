"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Pencil, Save, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MarkdownEditor } from "@/components/markdown-editor";
import { RemarkAttachments } from "@/components/testcasesheet/remark-attachments";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
import { listAttachmentsByIds, type signedAttachment } from "@/lib/supabase/attachment-actions";
import { deleteDefect, updateDefect } from "@/lib/supabase/defect-actions";
import { DEFECT_SEVERITIES, DEFECT_STATUS_LABELS, jiraUrlError } from "@/lib/supabase/defect-format";
import type { defect, defectSeverity, defectStatus } from "@/lib/supabase/defects";
import { humanizeTimestamp } from "@/lib/utils";
import { SEVERITY_CLASSNAMES, STATUS_CLASSNAMES } from "./defect-badges";

const markdownLink = { a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> };

// The full defect: saved references with their evidence, a link back to the source result, edit and delete.
export function DefectSheet({ defect, suiteSlug, iterationNumber, onClose }: { defect: defect | null; suiteSlug: string; iterationNumber: number | null; onClose: () => void }) {
	return (
		<Sheet open={!!defect} onOpenChange={(open) => { if (!open) onClose(); }}>
			<SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[60vw] data-[side=right]:lg:w-[45vw]">
				{/* Keyed so each defect starts in view mode with its own files. */}
				{defect && <DefectBody key={defect.id} defect={defect} suiteSlug={suiteSlug} iterationNumber={iterationNumber} onClose={onClose} />}
			</SheetContent>
		</Sheet>
	);
}

function DefectBody({ defect, suiteSlug, iterationNumber, onClose }: { defect: defect; suiteSlug: string; iterationNumber: number | null; onClose: () => void }) {
	const [editing, setEditing] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [files, setFiles] = useState<Record<string, signedAttachment>>({});
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [summary, setSummary] = useState(defect.summary);
	const [description, setDescription] = useState(defect.description);
	const [severity, setSeverity] = useState<defectSeverity>(defect.severity);
	const [status, setStatus] = useState<defectStatus>(defect.status);
	const [jiraUrl, setJiraUrl] = useState(defect.jiraUrl ?? "");
	const jiraError = jiraUrlError(jiraUrl);

	// Saved attachment ids; files that were removed with their remark simply don't come back.
	const attachmentKey = defect.references.flatMap((r) => r.attachmentIds).join(",");
	useEffect(() => {
		if (!attachmentKey) return;
		let cancelled = false;
		listAttachmentsByIds({ ids: attachmentKey.split(",") }).then((res) => {
			if (cancelled || !res.ok) return;
			setFiles(Object.fromEntries(res.data.map((a) => [a.id, a])));
		});
		return () => { cancelled = true; };
	}, [attachmentKey]);

	function startEdit() {
		setSummary(defect.summary);
		setDescription(defect.description);
		setSeverity(defect.severity);
		setStatus(defect.status);
		setJiraUrl(defect.jiraUrl ?? "");
		setError(null);
		setEditing(true);
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const res = await updateDefect({ id: defect.id, summary, description, severity, status, jiraUrl });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			toast.success(`${defect.code} saved`);
			setEditing(false);
		});
	}

	function onDelete() {
		startTransition(async () => {
			const res = await deleteDefect(defect.id);
			if (!res.ok) {
				toast.error(res.error);
				setConfirmingDelete(false);
				return;
			}
			toast.success(`${defect.code} deleted`);
			setConfirmingDelete(false);
			onClose();
		});
	}

	const sourceHref = defect.testCaseResultId && defect.sectionSlug && iterationNumber !== null
		? testResultsHref(suiteSlug, defect.sectionSlug, { iteration: iterationNumber, org: defect.organizationId })
		: null;

	return (
		<>
			<SheetHeader className="px-4 pt-6 md:px-8 md:pt-10">
				<SheetDescription className="font-mono text-xs font-semibold">{defect.code}</SheetDescription>
				{editing ? (
					<div className="flex flex-col gap-1">
						<Label htmlFor="defect-edit-summary" className="text-xs text-muted-foreground">Summary</Label>
						<Input id="defect-edit-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} disabled={isPending} />
					</div>
				) : (
					<SheetTitle className="text-lg">{defect.summary}</SheetTitle>
				)}
				{!editing && (
					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Badge variant="outline" className={SEVERITY_CLASSNAMES[defect.severity]}>{DEFECT_SEVERITIES.find((s) => s.value === defect.severity)?.label}</Badge>
						<Badge variant="outline" className={STATUS_CLASSNAMES[defect.status]}>{DEFECT_STATUS_LABELS[defect.status]}</Badge>
						<span className="text-xs text-muted-foreground">Logged {humanizeTimestamp(defect.createdAt)}</span>
					</div>
				)}
			</SheetHeader>

			<div className="flex flex-col gap-5 px-4 pb-6 md:px-8">
				{editing ? (
					<>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-1">
								<Label className="text-xs text-muted-foreground">Severity</Label>
								<Select value={severity} onValueChange={(v) => v && setSeverity(v as defectSeverity)} disabled={isPending}>
									<SelectTrigger className="w-full"><SelectValue>{DEFECT_SEVERITIES.find((s) => s.value === severity)?.label}</SelectValue></SelectTrigger>
									<SelectContent>{DEFECT_SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-xs text-muted-foreground">Status</Label>
								<Select value={status} onValueChange={(v) => v && setStatus(v as defectStatus)} disabled={isPending}>
									<SelectTrigger className="w-full"><SelectValue>{DEFECT_STATUS_LABELS[status]}</SelectValue></SelectTrigger>
									<SelectContent>{(Object.keys(DEFECT_STATUS_LABELS) as defectStatus[]).map((s) => <SelectItem key={s} value={s}>{DEFECT_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="defect-edit-jira" className="text-xs text-muted-foreground">Jira link</Label>
							<Input id="defect-edit-jira" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} disabled={isPending} placeholder="https://yourteam.atlassian.net/browse/ABC-123" aria-invalid={!!jiraError} />
							{jiraError && <p className="text-xs text-destructive">{jiraError}</p>}
						</div>
						<div className="flex flex-col gap-1">
							<Label className="text-xs text-muted-foreground">Description</Label>
							<MarkdownEditor value={description} onChange={setDescription} placeholder="Steps, expected vs actual, notes" disabled={isPending} />
						</div>
						{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
						<div className="flex flex-row justify-end gap-2">
							<Button variant="outline" onClick={() => setEditing(false)} disabled={isPending}><X className="size-4" />Cancel</Button>
							<Button onClick={onSave} disabled={isPending || !summary.trim() || !!jiraError}><Save className="size-4" />{isPending ? "Saving…" : "Save"}</Button>
						</div>
					</>
				) : (
					<>
						<div className="flex flex-col gap-1">
							<p className="text-xs font-medium text-muted-foreground">Description</p>
							{defect.description.trim()
								? <div className="typeset text-sm break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLink}>{defect.description}</ReactMarkdown></div>
								: <p className="text-sm text-muted-foreground">No description.</p>}
						</div>
						<div className="flex flex-col gap-1">
							<p className="text-xs font-medium text-muted-foreground">Jira</p>
							{defect.jiraUrl
								? <a href={defect.jiraUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline break-all">{defect.jiraUrl}<ExternalLink className="size-3 shrink-0" /></a>
								: <p className="text-sm text-muted-foreground">No Jira link.</p>}
						</div>
					</>
				)}

				<div className="flex flex-col gap-2">
					<div className="flex flex-row items-center justify-between gap-2">
						<p className="text-xs font-medium text-muted-foreground">Test case</p>
						{sourceHref
							? <Link href={sourceHref} className="inline-flex items-center gap-1 text-xs underline">Open source result<ExternalLink className="size-3" /></Link>
							: <Badge variant="outline" className="text-muted-foreground">Source removed</Badge>}
					</div>
					<p className="text-sm"><span className="font-mono text-xs">{defect.caseCode ?? "—"}</span> {defect.caseTitle}</p>
				</div>

				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium text-muted-foreground">Reference{defect.references.length > 1 ? "s" : ""}</p>
					{defect.references.map((ref, i) => (
						<div key={ref.remarkId ?? i} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
							<div className="flex flex-row items-start justify-between gap-2">
								<p className="text-sm"><span className="font-semibold">{ref.stepOrder === null ? "Overall feedback" : `Step ${ref.stepOrder + 1}`}:</span> {ref.stepText ?? "Overall feedback on this test case"}</p>
								{!ref.remarkId && <Badge variant="outline" className="shrink-0 text-muted-foreground">Source removed</Badge>}
							</div>
							{ref.remarkText && (
								<div className="typeset text-sm break-words border-l-2 pl-3">
									<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLink}>{ref.remarkText}</ReactMarkdown>
								</div>
							)}
							{ref.evidenceLinks.length > 0 && (
								<ul className="flex flex-col gap-1">
									{ref.evidenceLinks.map((link) => (
										<li key={link.url}>
											<a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline"><Link2 className="size-3" />{link.label}</a>
										</li>
									))}
								</ul>
							)}
							<RemarkAttachments attachments={ref.attachmentIds.flatMap((id) => files[id] ?? [])} />
						</div>
					))}
				</div>

				{!editing && (
					<div className="flex flex-row justify-end gap-2 border-t pt-4">
						<Button variant="outline" onClick={startEdit}><Pencil className="size-4" />Edit</Button>
						<Button variant="destructive" onClick={() => setConfirmingDelete(true)}><Trash2 className="size-4" />Delete</Button>
					</div>
				)}
			</div>

			<Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete {defect.code}?</DialogTitle>
						<DialogDescription>This removes the defect and its saved references. The client&apos;s remarks aren&apos;t affected.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
						<Button variant="destructive" onClick={onDelete} disabled={isPending}><Trash2 className="size-4" />{isPending ? "Deleting…" : "Delete"}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
