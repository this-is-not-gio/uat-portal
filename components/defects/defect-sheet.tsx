"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { type LucideIcon, ChevronDown, CircleCheck, CircleDot, CircleSlash, ClipboardList, ExternalLink, GitBranch, Link2, MoreHorizontal, Pencil, Save, Trash2, X, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SEVERITY_CLASSNAMES, SEVERITY_ICONS, STATUS_FIELD_CLASSNAMES, STATUS_ICONS } from "./defect-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MarkdownEditor } from "@/components/markdown-editor";
import { RemarkAttachments } from "@/components/testcasesheet/remark-attachments";
import { RemarkCard } from "@/components/testcasesheet/remark-card";
import type { testRemark } from "@/lib/supabase/test-cases";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
import { listAttachmentsByIds, type signedAttachment } from "@/lib/supabase/attachment-actions";
import { deleteDefect, getDefectThreads, updateDefect } from "@/lib/supabase/defect-actions";
import { DEFECT_SEVERITIES, DEFECT_STATUS_LABELS, defectRef, jiraUrlError } from "@/lib/supabase/defect-format";
import type { defect, defectSeverity, defectStatus } from "@/lib/supabase/defects";
import { BADGE_VARIANTS } from "@/components/sidebar/app-sidebar";
import { cn, humanizeTimestamp, initials } from "@/lib/utils";

const markdownLink = { a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> };

// The full defect: saved references with their evidence, a link back to the source result, edit and delete.
export function DefectSheet({ defect, suiteSlug, iterationNumber, onClose }: { defect: defect | null; suiteSlug?: string; iterationNumber?: number | null; onClose: () => void }) {
	return (
		<Sheet open={!!defect} onOpenChange={(open) => { if (!open) onClose(); }}>
			<SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[60vw] data-[side=right]:lg:w-[45vw]">
				{/* Keyed so each defect starts in view mode with its own files. */}
				{defect && <DefectBody key={defect.id} defect={defect} suiteSlug={suiteSlug} iterationNumber={iterationNumber} onClose={onClose} />}
			</SheetContent>
		</Sheet>
	);
}

function FieldOption({ Icon, label }: { Icon: LucideIcon; label?: string }) {
	return <span className="flex items-center gap-1.5"><Icon className="size-4" />{label}</span>;
}

function DefectBody({ defect, suiteSlug, iterationNumber, onClose }: { defect: defect; suiteSlug?: string; iterationNumber?: number | null; onClose: () => void }) {
	const [editing, setEditing] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [files, setFiles] = useState<Record<string, signedAttachment>>({});
	// Full remark threads behind the cited remarks, loaded once the sheet opens.
	const [thread, setThread] = useState<{ threads: Record<string, testRemark[]>; files: Record<string, signedAttachment[]> }>({ threads: {}, files: {} });
	const [loadedId, setLoadedId] = useState<string | null>(null);
	const threadLoading = loadedId !== defect.id;
	useEffect(() => {
		let cancelled = false;
		getDefectThreads(defect.id).then((res) => {
			if (cancelled) return;
			if (res.ok) setThread(res.data);
			setLoadedId(defect.id);
		});
		return () => { cancelled = true; };
	}, [defect.id]);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [summary, setSummary] = useState(defect.summary);
	const [description, setDescription] = useState(defect.description);
	const [severity, setSeverity] = useState<defectSeverity>(defect.severity);
	const [status, setStatus] = useState<defectStatus>(defect.status);
	const [jiraUrl, setJiraUrl] = useState(defect.jiraUrl ?? "");
	const jiraError = jiraUrlError(jiraUrl);
	const [editingJira, setEditingJira] = useState(false);
	const [jiraDraft, setJiraDraft] = useState("");
	const jiraDraftError = jiraUrlError(jiraDraft);

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

	// Severity / status save on pick: the field shows the new value at once and snaps back if the save fails.
	const [shown, setShown] = useOptimistic({ severity: defect.severity, status: defect.status }, (cur, change: { severity?: defectSeverity; status?: defectStatus }) => ({ ...cur, ...change }));
	function quickUpdate(change: { severity?: defectSeverity; status?: defectStatus }) {
		startTransition(async () => {
			setShown(change);
			const res = await updateDefect({
				id: defect.id,
				summary: defect.summary,
				description: defect.description,
				jiraUrl: defect.jiraUrl ?? "",
				...shown,
				...change,
			});
			if (!res.ok) toast.error(res.error);
		});
	}

	// Jira link edits on its own from the header; everything else on the defect stays as it is.
	function saveJira() {
		startTransition(async () => {
			const res = await updateDefect({ id: defect.id, summary: defect.summary, description: defect.description, ...shown, jiraUrl: jiraDraft });
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			setJiraUrl(jiraDraft.trim());
			setEditingJira(false);
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

	// Opened from the case itself (no suite/round given): the source is right here, so no link.
	const fromCase = suiteSlug === undefined;
	const sourceHref = !fromCase && defect.testCaseResultId && defect.sectionSlug && iterationNumber != null
		? testResultsHref(suiteSlug, defect.sectionSlug, { iteration: iterationNumber, org: defect.organizationId })
		: null;

	const StatusIcon = STATUS_ICONS[shown.status];

	return (
		<>
			<SheetHeader className="px-4 pt-6 md:px-8 md:pt-10 flex flex-col gap-3 pb-0">
				{editing ? (
					<div className="flex flex-col gap-1">
						<Label htmlFor="defect-edit-summary" className="text-xs text-muted-foreground">Summary</Label>
						<Input id="defect-edit-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} disabled={isPending} />
					</div>
				) : (
					<>
						<div className="flex flex-col gap-1">
							<SheetTitle className="text-lg">{defect.summary}</SheetTitle>
							<SheetDescription className="font-mono text-xs font-semibold">{defectRef(defect)}</SheetDescription>
						</div>
						<div className="flex flex-row items-end gap-4">
							<div className="flex flex-col gap-1">
								<Label className="text-xs text-muted-foreground">Status</Label>
								<div className={cn("py-1 px-3 flex flex-row items-center gap-2 border rounded-md", STATUS_FIELD_CLASSNAMES[shown.status])}>
									<StatusIcon className="size-4" />{DEFECT_STATUS_LABELS[shown.status]}
								</div>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-xs text-muted-foreground">Severity</Label>
								<Select value={shown.severity} onValueChange={(v) => v && quickUpdate({ severity: v as defectSeverity })}>
									<SelectTrigger size="sm" aria-label="Severity" className={cn("w-40 data-[size=default]:h-10", SEVERITY_CLASSNAMES[shown.severity])}>
										<SelectValue><FieldOption Icon={SEVERITY_ICONS[shown.severity]} label={DEFECT_SEVERITIES.find((s) => s.value === shown.severity)?.label} /></SelectValue>
									</SelectTrigger>
									<SelectContent>{DEFECT_SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}><FieldOption Icon={SEVERITY_ICONS[s.value]} label={s.label} /></SelectItem>)}</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-1 flex-1 min-w-0">
								<div className="flex flex-row items-center gap-1">
									<Label className="text-xs text-muted-foreground">Jira link</Label>
									{!editingJira && (
										<Tooltip>
											<TooltipTrigger render={<Button variant="ghost" size="icon" className="size-5" aria-label="Edit Jira link" onClick={() => { setJiraDraft(defect.jiraUrl ?? ""); setEditingJira(true); }} />}>
												<Pencil className="size-3" />
											</TooltipTrigger>
											<TooltipContent>Edit Jira link</TooltipContent>
										</Tooltip>
									)}
								</div>
								{editingJira ? (
									<div className="flex flex-col gap-1 w-full">
										<div className="flex flex-row items-center gap-1 w-full">
											<Input className="w-full" value={jiraDraft} onChange={(e) => setJiraDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !jiraDraftError) saveJira(); if (e.key === "Escape") setEditingJira(false); }} disabled={isPending} autoFocus placeholder="https://yourteam.atlassian.net/browse/ABC-123" aria-label="Jira link" aria-invalid={!!jiraDraftError} />
											<Button size="icon" className="size-8" aria-label="Save Jira link" onClick={saveJira} disabled={isPending || !!jiraDraftError}><Save className="size-4" /></Button>
											<Button variant="outline" size="icon" className="size-8" aria-label="Cancel" onClick={() => setEditingJira(false)} disabled={isPending}><X className="size-4" /></Button>
										</div>
										{jiraDraftError && <p className="text-xs text-destructive">{jiraDraftError}</p>}
									</div>
								) : (
									<div className="flex h-8 items-center">
										{defect.jiraUrl ? <a href={defect.jiraUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline break-all font-mono"><ExternalLink className="size-4 shrink-0" />{defect.jiraUrl}</a> : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><ExternalLink className="size-4 shrink-0" />No Jira URL</span>}
									</div>
								)}
							</div>
						</div>
					</>
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
							<div className="flex flex-row items-center gap-2 pb-3">
								<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
									<ClipboardList />
								</div>
								<div className="flex flex-col gap-0">
									<h3 className="text-lg font-semibold">Description</h3>
									<p className="text-xs text-muted-foreground">What went wrong and how to reproduce it.</p>
								</div>
							</div>
							{defect.description.trim()
								? <div className="typeset text-sm break-words py-2 pl-4"><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLink}>{defect.description}</ReactMarkdown></div>
								: <p className="text-sm text-muted-foreground">No description.</p>}
						</div>
					</>
				)}

				{/* <div className="flex flex-col gap-2">
					<div className="flex flex-row items-center justify-between gap-2">
						<p className="text-xs font-medium text-muted-foreground">Test case</p>
						{fromCase && defect.testCaseResultId ? null : sourceHref
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
				</div> */}

				<div className="">
					<div className="flex flex-row items-center gap-2 pb-3">
						<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
							<GitBranch />
						</div>
						<div className="flex flex-col gap-0">
							<h3 className="text-lg font-semibold">Defect Reference</h3>
							<p className="text-xs text-muted-foreground">What went wrong and how to reproduce it.</p>
						</div>
					</div>
					<div className="flex flex-col py-2">
						{/* First node: the failed test case. Then one node per cited step or the overall feedback. */}
						<div className="flex flex-row gap-3">
							<div className="flex flex-col items-center">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-800"><XCircle className="size-5" /></div>
								{defect.references.length > 0 && <div className="w-0.5 flex-1 min-h-4 bg-border" />}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
								<div className="flex min-h-10 flex-row flex-wrap items-center justify-between gap-2">
									<div className="flex flex-col">
										<p className="text-xs text-muted-foreground">Failed test case</p>
										<p className="text-sm font-semibold"><span className="font-mono text-xs">{defect.caseCode ?? "—"}</span> {defect.caseTitle}</p>
									</div>
									{fromCase && defect.testCaseResultId ? null : sourceHref
										? <Button variant="outline" size="icon" nativeButton={false} render={<Link href={sourceHref} />}><ExternalLink className="" /></Button>
										: <Badge variant="outline" className="text-muted-foreground">Source removed</Badge>}
								</div>
								{(defect.executorName || defect.resultStatus) && (
									<div className="flex flex-col gap-2 py-2">
										<p className="text-xs text-muted-foreground">Test executed by:</p>
										<div className="flex flex-row items-center justify-between gap-2">
											<div className="flex flex-row items-center gap-2">
												<div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", (BADGE_VARIANTS[(defect.executorOrgType ?? "fallback") as keyof typeof BADGE_VARIANTS] ?? BADGE_VARIANTS.fallback).UserClassName)}><p className="text-sm font-bold text-white">{defect.executorName ? initials(defect.executorName) : "?"}</p></div>
												<div className="flex flex-col">
													<p className="text-sm font-medium">{defect.executorName ?? "Unknown tester"}</p>
													{defect.completedAt && <p className="text-xs text-muted-foreground">Tested {humanizeTimestamp(defect.completedAt)}</p>}
												</div>
											</div>
											{defect.resultStatus && <Badge variant="outline" className={cn("h-5", defect.resultStatus === "Failed" ? SEVERITY_CLASSNAMES.critical : "text-muted-foreground")}>{defect.resultStatus}</Badge>}
										</div>
									</div>
								)}
							</div>
						</div>
						{defect.references.map((ref, i) => (
							<div key={ref.remarkId ?? i} className="flex flex-row gap-3">
								<div className="flex flex-col items-center">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500"><CircleDot className="size-5" /></div>
									{i < defect.references.length - 1 && <div className="w-0.5 flex-1 min-h-4 bg-border" />}
								</div>
								<div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
									<div className="flex min-h-10 flex-row flex-wrap items-center justify-between gap-2">
										<div className="flex flex-col">
											<p className="text-xs text-muted-foreground">{ref.stepOrder === null ? "Overall feedback" : `Step ${ref.stepOrder + 1}`}</p>
											<p className="text-sm font-semibold">{ref.stepText ?? "Overall feedback on this test case"}</p>
										</div>
										{!ref.remarkId && <Badge variant="outline" className="shrink-0 text-muted-foreground">Source removed</Badge>}
									</div>
									{ref.remarkId && threadLoading ? (
										<div className="flex flex-row gap-3 pt-2">
											<Skeleton className="size-10 shrink-0 rounded-full" />
											<div className="flex flex-1 flex-col gap-2">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-full" />
												<Skeleton className="h-3 w-2/3" />
											</div>
										</div>
									) : ref.remarkId && thread.threads[ref.remarkId]?.length ? (
										<div className="flex flex-col pt-2">
											{thread.threads[ref.remarkId].map((remark) => (
												<RemarkCard key={remark.id} remark={remark} files={thread.files[remark.id] ?? []} action={remark.id === ref.remarkId ? <Badge variant="outline" className="border-red-700 bg-red-100/60 text-red-700">Reported</Badge> : undefined} />
											))}
										</div>
									) : ref.remarkText ? (
										<div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3">
											<p className="text-xs font-medium text-muted-foreground">Remark (saved copy)</p>
											<div className="typeset text-sm break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLink}>{ref.remarkText}</ReactMarkdown></div>
											{ref.evidenceLinks.length > 0 && (
												<ul className="flex flex-col gap-1 pt-1">
													{ref.evidenceLinks.map((link) => (
														<li key={link.url}>
															<a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline"><Link2 className="size-3" />{link.label}</a>
														</li>
													))}
												</ul>
											)}
											<RemarkAttachments attachments={ref.attachmentIds.flatMap((id) => files[id] ?? [])} />
										</div>
									) : null}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{!editing && (
				<SheetFooter className="flex flex-row justify-end sticky bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t p-4">
					{shown.status === "open" ? (
						<div className="flex flex-row">
							<Button variant="outline" className="rounded-r-none" onClick={() => quickUpdate({ status: "resolved" })} disabled={isPending}><CircleCheck className="size-4 text-purple-600" />Close defect</Button>
							<DropdownMenu>
								<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More ways to close" className="rounded-l-none border-l-0" disabled={isPending} />}>
									<ChevronDown className="size-4" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-auto min-w-max">
									<DropdownMenuItem onClick={() => quickUpdate({ status: "wont_fix" })}><CircleSlash className="size-4 text-stone-500" />Close as won&apos;t fix</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					) : (
						<Button variant="outline" onClick={() => quickUpdate({ status: "open" })} disabled={isPending}><CircleDot className="size-4 text-emerald-600" />Reopen defect</Button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" disabled={isPending} />}>
							<MoreHorizontal className="size-4" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={startEdit}><Pencil className="size-4" />Edit</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={() => setConfirmingDelete(true)}><Trash2 className="size-4" />Delete</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SheetFooter>
			)}

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
