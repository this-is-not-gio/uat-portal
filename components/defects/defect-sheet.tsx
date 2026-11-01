"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { type LucideIcon, ChevronDown, CircleCheck, CircleDot, CircleSlash, ClipboardList, ExternalLink, FileText, GitBranch, Link2, ListChecks, MoreHorizontal, Pencil, Plus, Save, SquareCheck, Trash2, TriangleAlert, X, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SEVERITY_CLASSNAMES, SEVERITY_ICONS, STATUS_FIELD_CLASSNAMES, STATUS_ICONS } from "./defect-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MarkdownEditor } from "@/components/markdown-editor";
import { RemarkAttachments } from "@/components/testcasesheet/remark-attachments";
import { RemarkCard } from "@/components/testcasesheet/remark-card";
import type { testRemark } from "@/lib/supabase/test-cases";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
import { listAttachmentsByIds, type signedAttachment } from "@/lib/supabase/attachment-actions";
import { deleteDefect, getDefectThreads, getIterationFailedCases, updateDefect, type defectFields, type defectLinks } from "@/lib/supabase/defect-actions";
import { DEFECT_SEVERITIES, DEFECT_STATUS_LABELS, defectRef, externalUrlError } from "@/lib/supabase/defect-format";
import type { defect, defectCase, defectSeverity, defectStatus } from "@/lib/supabase/defects";
import { BADGE_VARIANTS } from "@/components/sidebar/app-sidebar";
import { cn, humanizeTimestamp, initials } from "@/lib/utils";

const markdownLink = { a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> };

type roundCase = { id: string; code: string | null; title: string };
type externalDraft = { label: string; url: string };
type saveResult = { ok: true } | { ok: false; error: string };
// Saves part of a defect; everything not named stays as it is.
type saveFn = (patch: Partial<defectFields> & Partial<defectLinks>) => Promise<saveResult>;

// The saved fields of a defect, as the update action wants them.
function fieldsOf(d: defect): defectFields {
	return { summary: d.summary, precondition: d.precondition, stepsToReproduce: d.stepsToReproduce, expectedResult: d.expectedResult, actualResult: d.actualResult, severity: d.severity };
}

// The full defect: written sections, what it cites (remarks with their evidence, failed cases) and external links.
// Every section edits on its own; status and severity save from the footer.
export function DefectSheet({ defect, suiteSlug, iterationNumber, onClose }: { defect: defect | null; suiteSlug?: string; iterationNumber?: number | null; onClose: () => void }) {
	return (
		<Sheet open={!!defect} onOpenChange={(open) => { if (!open) onClose(); }}>
			<SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[60vw] data-[side=right]:lg:w-[50vw]">
				{/* Keyed so each defect starts with its own files and closed editors. */}
				{defect && <DefectBody key={defect.id} defect={defect} suiteSlug={suiteSlug} iterationNumber={iterationNumber} onClose={onClose} />}
			</SheetContent>
		</Sheet>
	);
}

function FieldOption({ Icon, label }: { Icon: LucideIcon; label?: string }) {
	return <span className="flex items-center gap-1.5"><Icon className="size-4" />{label}</span>;
}

function SectionHeading({ Icon, title, hint, onEdit }: { Icon: LucideIcon; title: string; hint: string; onEdit?: () => void }) {
	return (
		<div className="flex flex-row items-center justify-between gap-2 pb-3">
			<div className="flex flex-col gap-2">
				<div className="flex flex-row items-center gap-2">
					<div className="flex flex-col items-center justify-center gap-0 size-6 rounded-md bg-muted text-black">
						<Icon size={13} />
					</div>
					<div className="flex flex-row items-center gap-1">
						<h3 className="text-lg font-semibold">{title}</h3>
						{onEdit && <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Edit ${title}`} onClick={onEdit}><Pencil className="size-4" /></Button>}
					</div>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0">
					<p className="text-xs text-muted-foreground">{hint}</p>
				</div>
			</div>
		</div>
	);
}

function SaveBar({ pending, disabled, error, onSave, onCancel }: { pending: boolean; disabled?: boolean; error: string | null; onSave: () => void; onCancel: () => void }) {
	return (
		<>
			{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
			<div className="flex flex-row justify-end gap-2">
				<Button variant="outline" size="sm" onClick={onCancel} disabled={pending}><X className="size-4" />Cancel</Button>
				<Button size="sm" onClick={onSave} disabled={pending || disabled}><Save className="size-4" />{pending ? "Saving…" : "Save"}</Button>
			</div>
		</>
	);
}

// One markdown field with its own edit button, editor and save.
function MarkdownSection({ Icon, title, hint, placeholder, value, onSave }: { Icon: LucideIcon; title: string; hint: string; placeholder: string; value: string; onSave: (value: string) => Promise<saveResult> }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	function save() {
		setError(null);
		startTransition(async () => {
			const res = await onSave(draft);
			if (!res.ok) return setError(res.error);
			setEditing(false);
		});
	}
	function startEditing() {
		setDraft(value);
		setError(null);
		setEditing(true);
	}
	// Jira-style: the content itself is the edit target; links inside it still open normally.
	const editTarget = "cursor-text rounded-md px-3 py-2 -mx-1 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
	return (
		<div className="flex flex-col gap-1">
			<SectionHeading Icon={Icon} title={title} hint={hint} />
			{editing ? (
				<div className="flex flex-col gap-2">
					<MarkdownEditor value={draft} onChange={setDraft} placeholder={placeholder} disabled={pending} />
					<SaveBar pending={pending} error={error} onSave={save} onCancel={() => setEditing(false)} />
				</div>
			) : (
				<div
					role="button"
					tabIndex={0}
					aria-label={`Edit ${title}`}
					title="Click to edit"
					className={editTarget}
					onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) startEditing(); }}
					onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); startEditing(); } }}
				>
					{value.trim() ? (
						<div className="typeset text-sm break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLink}>{value}</ReactMarkdown></div>
					) : (
						<p className="text-sm text-muted-foreground">Click to add…</p>
					)}
				</div>
			)}
		</div>
	);
}

// Unlink cited remarks and cases, or add failed cases of the round.
function ReferencesEditor({ defect, onSave, onCancel }: { defect: defect; onSave: saveFn; onCancel: () => void }) {
	const [removedRemarks, setRemovedRemarks] = useState<string[]>([]);
	const [removedCases, setRemovedCases] = useState<string[]>([]);
	const [addedCases, setAddedCases] = useState<roundCase[]>([]);
	const [roundCases, setRoundCases] = useState<roundCase[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	useEffect(() => {
		let cancelled = false;
		getIterationFailedCases(defect.iterationId).then((res) => { if (!cancelled) setRoundCases(res.ok ? res.data : []); });
		return () => { cancelled = true; };
	}, [defect.iterationId]);

	const keptCaseIds = defect.cases.flatMap((c) => (c.caseResultId && !removedCases.includes(c.caseResultId) ? [c.caseResultId] : []));
	const addable = (roundCases ?? []).filter((c) => !keptCaseIds.includes(c.id) && !addedCases.some((a) => a.id === c.id));
	function save() {
		setError(null);
		startTransition(async () => {
			const res = await onSave({
				remarkIds: defect.references.flatMap((r) => (r.remarkId && !removedRemarks.includes(r.remarkId) ? [r.remarkId] : [])),
				caseResultIds: [...keptCaseIds, ...addedCases.map((c) => c.id)],
			});
			if (!res.ok) setError(res.error);
		});
	}
	const items = [
		...defect.cases.map((c) => ({ key: `c${c.caseResultId ?? c.caseCode}`, id: c.caseResultId, kind: "case" as const, code: c.caseCode, title: c.caseTitle, removed: !!c.caseResultId && removedCases.includes(c.caseResultId) })),
		...addedCases.map((c) => ({ key: `a${c.id}`, id: c.id, kind: "added" as const, code: c.code, title: c.title, removed: false })),
		...defect.references.map((r, i) => ({ key: `r${r.remarkId ?? i}`, id: r.remarkId, kind: "remark" as const, code: r.caseCode, title: `${r.stepOrder === null ? "Overall feedback" : `Step ${r.stepOrder + 1}`} remark · ${r.caseTitle}`, removed: !!r.remarkId && removedRemarks.includes(r.remarkId) })),
	];
	return (
		<div className="flex flex-col gap-2">
			{items.length === 0 && <p className="text-sm text-muted-foreground">Nothing is linked.</p>}
			{items.map((item) => (
				<div key={item.key} className={cn("flex flex-row items-center justify-between gap-2 rounded-md border px-3 py-2", item.removed && "opacity-50")}>
					<p className="min-w-0 text-sm"><span className="font-mono text-xs">{item.code ?? "—"}</span> <span className={cn(item.removed && "line-through")}>{item.title}</span></p>
					{item.id && (item.removed
						? <Button variant="ghost" size="sm" disabled={pending} onClick={() => (item.kind === "remark" ? setRemovedRemarks((l) => l.filter((x) => x !== item.id)) : setRemovedCases((l) => l.filter((x) => x !== item.id)))}>Undo</Button>
						: <Button variant="ghost" size="icon" className="size-7" aria-label="Unlink" disabled={pending} onClick={() => {
							if (item.kind === "remark") setRemovedRemarks((l) => [...l, item.id!]);
							else if (item.kind === "case") setRemovedCases((l) => [...l, item.id!]);
							else setAddedCases((l) => l.filter((c) => c.id !== item.id));
						}}><X className="size-4" /></Button>)}
				</div>
			))}
			{addable.length > 0 && (
				<div className="flex flex-col gap-1 pt-1">
					<p className="text-xs text-muted-foreground">Add a failed test case from this round</p>
					<div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
						{addable.map((c) => (
							<button key={c.id} type="button" disabled={pending} onClick={() => setAddedCases((l) => [...l, c])} className="flex flex-row items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
								<Plus className="size-4 shrink-0" /><span className="font-mono text-xs">{c.code ?? "—"}</span><span className="min-w-0 truncate">{c.title}</span>
							</button>
						))}
					</div>
				</div>
			)}
			<SaveBar pending={pending} error={error} onSave={save} onCancel={onCancel} />
		</div>
	);
}

function ExternalEditor({ defect, onSave, onCancel }: { defect: defect; onSave: saveFn; onCancel: () => void }) {
	const [externals, setExternals] = useState<externalDraft[]>(defect.externalRefs.map((e) => ({ ...e })));
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const urlErrors = externals.map((e) => (e.url.trim() ? externalUrlError(e.url.trim()) : null));
	function save() {
		setError(null);
		startTransition(async () => {
			const res = await onSave({ externalRefs: externals });
			if (!res.ok) setError(res.error);
		});
	}
	return (
		<div className="flex flex-col gap-2">
			{externals.map((e, i) => (
				<div key={i} className="flex flex-col gap-1">
					<div className="flex flex-row items-center gap-2">
						<Input className="w-28 shrink-0" value={e.label} maxLength={60} placeholder="Label" aria-label="Label" onChange={(ev) => setExternals((l) => l.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} disabled={pending} />
						<Input className="min-w-0 flex-1" value={e.url} placeholder="https://yourteam.atlassian.net/browse/ABC-123" aria-label="URL" aria-invalid={!!urlErrors[i]} onChange={(ev) => setExternals((l) => l.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))} disabled={pending} />
						<Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Remove link" onClick={() => setExternals((l) => l.filter((_, j) => j !== i))} disabled={pending}><X className="size-4" /></Button>
					</div>
					{urlErrors[i] && <p className="text-xs text-destructive">{urlErrors[i]}</p>}
				</div>
			))}
			<Button variant="outline" size="sm" className="self-start" onClick={() => setExternals((l) => [...l, { label: "", url: "" }])} disabled={pending}><Plus className="size-4" />Add link</Button>
			<SaveBar pending={pending} disabled={urlErrors.some(Boolean)} error={error} onSave={save} onCancel={onCancel} />
		</div>
	);
}

function DefectBody({ defect, suiteSlug, iterationNumber, onClose }: { defect: defect; suiteSlug?: string; iterationNumber?: number | null; onClose: () => void }) {
	const [editingSummary, setEditingSummary] = useState(false);
	const [editingReferences, setEditingReferences] = useState(false);
	const [editingExternal, setEditingExternal] = useState(false);
	const [summary, setSummary] = useState(defect.summary);
	const [summaryError, setSummaryError] = useState<string | null>(null);
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

	// Severity / status save on pick: the field shows the new value at once and snaps back if the save fails.
	const [shown, setShown] = useOptimistic({ severity: defect.severity, status: defect.status }, (cur, change: { severity?: defectSeverity; status?: defectStatus }) => ({ ...cur, ...change }));
	// One save for every section: the saved defect plus the part being changed.
	const save: saveFn = async (patch) => {
		return updateDefect({ id: defect.id, ...fieldsOf(defect), ...shown, ...patch });
	};
	function quickUpdate(change: { severity?: defectSeverity; status?: defectStatus }) {
		startTransition(async () => {
			setShown(change);
			await updateDefect({ id: defect.id, ...fieldsOf(defect), ...shown, ...change });
		});
	}
	function saveSummary() {
		setSummaryError(null);
		startTransition(async () => {
			const res = await save({ summary });
			if (!res.ok) return setSummaryError(res.error);
			setEditingSummary(false);
		});
	}

	function onDelete() {
		startTransition(async () => {
			const res = await deleteDefect(defect.id);
			setConfirmingDelete(false);
			if (!res.ok) return;
			onClose();
		});
	}

	// Opened from the case itself (no suite/round given): the source is right here, so no link.
	const fromCase = suiteSlug === undefined;
	const hrefFor = (c: defectCase) =>
		!fromCase && c.caseResultId && c.sectionSlug && iterationNumber != null ? testResultsHref(suiteSlug, c.sectionSlug, { iteration: iterationNumber, org: c.organizationId }) : null;

	const StatusIcon = STATUS_ICONS[shown.status];
	const nodeCount = defect.cases.length + defect.references.length;

	return (
		<>
			<SheetHeader className="px-4 pt-6 md:px-8 md:pt-10 flex flex-col gap-3 pb-0">
				{editingSummary ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="defect-edit-summary" className="text-xs text-muted-foreground">Summary</Label>
						<Input id="defect-edit-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} disabled={isPending} autoFocus />
						<SheetTitle className="sr-only">Edit summary of {defect.code}</SheetTitle>
						<SheetDescription className="sr-only">Edit the summary of this defect.</SheetDescription>
						<SaveBar pending={isPending} disabled={!summary.trim()} error={summaryError} onSave={saveSummary} onCancel={() => setEditingSummary(false)} />
					</div>
				) : (
					<div className="flex flex-row items-start justify-between gap-2">
						<div className="flex min-w-0 flex-col">
							<SheetDescription className="font-mono text-xs font-semibold">{defectRef(defect)}</SheetDescription>
							<SheetTitle className="text-lg font-semibold">{defect.summary}</SheetTitle>
						</div>
						<Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Edit summary" onClick={() => { setSummary(defect.summary); setSummaryError(null); setEditingSummary(true); }}><Pencil className="size-4" /></Button>
					</div>
				)}
			</SheetHeader>

			<div className="flex flex-col gap-6 px-4 pb-6 md:px-8">
				<MarkdownSection Icon={ListChecks} title="Precondition" hint="What must be true before the steps." placeholder="What must be true before the steps" value={defect.precondition} onSave={(v) => save({ precondition: v })} />
				<MarkdownSection Icon={ClipboardList} title="Steps to Reproduce" hint="How to trigger the problem." placeholder="Numbered steps that trigger the problem" value={defect.stepsToReproduce} onSave={(v) => save({ stepsToReproduce: v })} />
				<MarkdownSection Icon={SquareCheck} title="Expected result" hint="What should have happened." placeholder="What should have happened" value={defect.expectedResult} onSave={(v) => save({ expectedResult: v })} />
				<MarkdownSection Icon={TriangleAlert} title="Actual result" hint="What happened instead." placeholder="What happened instead" value={defect.actualResult} onSave={(v) => save({ actualResult: v })} />

				<div>
					<SectionHeading Icon={GitBranch} title="Result Reference" hint="The failed test cases and remarks behind this defect." onEdit={editingReferences ? undefined : () => setEditingReferences(true)} />
					{editingReferences ? (
						<ReferencesEditor defect={defect} onCancel={() => setEditingReferences(false)} onSave={async (patch) => {
							const res = await save(patch);
							if (res.ok) setEditingReferences(false);
							return res;
						}} />
					) : nodeCount === 0 ? (
						<p className="text-sm text-muted-foreground pl-4">Nothing is linked yet. Use the pencil to link remarks or failed test cases.</p>
					) : (
						<div className="flex flex-col py-2">
							{defect.cases.map((c, i) => {
								const href = hrefFor(c);
								return (
									<div key={c.caseResultId ?? `case-${i}`} className="flex flex-row gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 border border-red-800"><XCircle className="size-5" /></div>
											{i < nodeCount - 1 && <div className="w-0.5 flex-1 min-h-4 bg-border" />}
										</div>
										<div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
											<div className="flex min-h-10 flex-row flex-wrap items-center justify-between gap-2">
												<div className="flex flex-col">
													<p className="text-xs text-muted-foreground">Failed test case</p>
													<p className="text-sm font-semibold"><span className="font-mono text-xs">{c.caseCode ?? "—"}</span> {c.caseTitle}</p>
												</div>
												{!c.caseResultId
													? <Badge variant="outline" className="text-muted-foreground">Source removed</Badge>
													: href && <Button variant="outline" size="icon" aria-label="Open source result" nativeButton={false} render={<Link href={href} />}><ExternalLink /></Button>}
											</div>
											{c.executorName && (
												<div className="flex flex-row items-center justify-between gap-2 py-2">
													<div className="flex flex-row items-center gap-2">
														<div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", (BADGE_VARIANTS[(c.executorOrgType ?? "fallback") as keyof typeof BADGE_VARIANTS] ?? BADGE_VARIANTS.fallback).UserClassName)}><p className="text-sm font-bold text-white">{initials(c.executorName)}</p></div>
														<div className="flex flex-col">
															<p className="text-sm font-medium">{c.executorName}</p>
															{c.completedAt && <p className="text-xs text-muted-foreground">Tested {humanizeTimestamp(c.completedAt)}</p>}
														</div>
													</div>
													{c.resultStatus && <Badge variant="outline" className={cn("h-5", c.resultStatus === "Failed" ? SEVERITY_CLASSNAMES.critical : "text-muted-foreground")}>{c.resultStatus}</Badge>}
												</div>
											)}
										</div>
									</div>
								);
							})}
							{defect.references.map((ref, i) => {
								const index = defect.cases.length + i;
								return (
									<div key={ref.remarkId ?? `ref-${i}`} className="flex flex-row gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500"><CircleDot className="size-5" /></div>
											{index < nodeCount - 1 && <div className="w-0.5 flex-1 min-h-4 bg-border" />}
										</div>
										<div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
											<div className="flex min-h-10 flex-row flex-wrap items-center justify-between gap-2">
												<div className="flex flex-col">
													<p className="text-xs text-muted-foreground"><span className="font-mono">{ref.caseCode ?? "—"}</span> · {ref.stepOrder === null ? "Overall feedback" : `Step ${ref.stepOrder + 1}`}</p>
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
								);
							})}
						</div>
					)}
				</div>

				<div>
					<SectionHeading Icon={FileText} title="External Reference" hint="Where this defect is tracked outside the portal." onEdit={editingExternal ? undefined : () => setEditingExternal(true)} />
					{editingExternal ? (
						<ExternalEditor defect={defect} onCancel={() => setEditingExternal(false)} onSave={async (patch) => {
							const res = await save(patch);
							if (res.ok) setEditingExternal(false);
							return res;
						}} />
					) : defect.externalRefs.length === 0 ? (
						<p className="text-sm text-muted-foreground pl-4">No external links.</p>
					) : (
						<ul className="flex flex-col gap-2 pl-4">
							{defect.externalRefs.map((e) => (
								<li key={e.url}>
									<a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm hover:underline break-all"><ExternalLink className="size-4 shrink-0" />{e.label && <span className="font-semibold">{e.label}</span>}<span className="font-mono text-xs">{e.url}</span></a>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<SheetFooter className="flex flex-row flex-wrap items-end justify-between gap-3 sticky bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t p-4">
				<div className="flex flex-row items-end gap-2">
					<div className={cn("py-1 px-2 flex flex-row items-center gap-1  rounded-md", STATUS_FIELD_CLASSNAMES[shown.status])}>
						<StatusIcon className="size-4" />
						<p className="text-sm font-semibold">
							{DEFECT_STATUS_LABELS[shown.status]}
						</p>
					</div>
					<Select value={shown.severity} onValueChange={(v) => v && quickUpdate({ severity: v as defectSeverity })}>
						<SelectTrigger size="sm" aria-label="Severity" className="w-36">
							<SelectValue><FieldOption Icon={SEVERITY_ICONS[shown.severity]} label={DEFECT_SEVERITIES.find((s) => s.value === shown.severity)?.label} /></SelectValue>
						</SelectTrigger>
						<SelectContent>{DEFECT_SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}><FieldOption Icon={SEVERITY_ICONS[s.value]} label={s.label} /></SelectItem>)}</SelectContent>
					</Select>
				</div>

				<div className="flex flex-row gap-2">
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
							<DropdownMenuItem variant="destructive" onClick={() => setConfirmingDelete(true)}><Trash2 className="size-4" />Delete</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</SheetFooter>

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
