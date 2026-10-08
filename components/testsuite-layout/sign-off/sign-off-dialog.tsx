"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckIcon, FileTextIcon, SparklesIcon, Stamp, StampIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { acknowledgeSignOff, createSignOff, draftSignOffThemes, previewSignOffReport, rejectSignOff, saveSignOffDraft } from "@/lib/supabase/iteration-actions";
import type { signOff, signOffDraft, statusCounts } from "@/lib/supabase/overview";
import type { organization } from "@/lib/supabase/organizations";
import type { CriterionResult, SignOffReport } from "@/lib/supabase/sign-off-report";
import { STALE_REMARK_ERROR, THEME_LIMITS, themeProblem, type ThemeInput } from "@/lib/report/sign-off-remarks";
import SignOffThemeEditor from "./sign-off-theme-editor";
import UnsubmittedOrgsWarning from "@/components/testsuite-layout/shared/unsubmitted-orgs-warning";

// Step 1 of sign-off (vendor). Opening it only previews the report; Create draft makes the draft
// ("Creating sign-off report", vendor-only) with the note. Issuing it to the client happens later.
// Hard gate: every round finished. Untested cases and other exceptions are only warnings.
// The client then acknowledges or rejects it (AcknowledgeSignOffDialog / RejectSignOffDialog).
// aiDraftAvailable: the server has an AI key, so "Draft with AI" can prefill observations.
export default function SignOffDialog({
	suiteId,
	draft,
	hasActiveIteration,
	latestCompleted,
	openUntestedCases,
	aiDraftAvailable,
	trigger,
}: {
	suiteId: string;
	// The saved draft, or null for a fresh report (created on Create draft).
	draft: signOffDraft | null;
	hasActiveIteration: boolean;
	latestCompleted: { name: string; counts: statusCounts; unsubmittedOrgs: organization[] } | null;
	openUntestedCases: number;
	aiDraftAvailable: boolean;
	trigger: React.ReactElement;
}) {
	const router = useRouter();
	const { testSuiteSlug } = useParams<{ testSuiteSlug: string }>();
	const [open, setOpen] = useState(false);
	const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [report, setReport] = useState<SignOffReport | null>(null);
	const [themes, setThemes] = useState<ThemeInput[]>([]);
	const [isLoadingReport, startLoadingReport] = useTransition();
	const [isPending, startTransition] = useTransition();
	const [draftError, setDraftError] = useState<string | null>(null);
	const [isDrafting, startDrafting] = useTransition();
	// Drops a preview that lands after the dialog was closed or reopened.
	const previewRequest = useRef(0);

	const blocker = hasActiveIteration
		? "Every test iteration must be finished first. Complete, stop or cancel the open one."
		: !latestCompleted
			? "At least one completed iteration is needed to issue the sign-off."
			: null;
	const hasExceptions = !!report && (report.verdict === "not_met" || report.totals.passed < report.totals.total);
	const remarkIds = new Set((report?.remarks ?? []).map((r) => r.id));
	const incompleteThemes = themes.filter((t) => themeProblem(t) || t.remarkIds.some((id) => !remarkIds.has(id))).length;

	// Opening the dialog only previews; nothing is saved until Create draft (ensureDraft).
	function loadPreview() {
		const request = ++previewRequest.current;
		setError(null);
		setReport(null);
		startLoadingReport(async () => {
			const result = await previewSignOffReport({ suiteId });
			if (request !== previewRequest.current) return;
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setReport(result.data);
		});
	}

	// Appends AI drafts after any observations already written; the admin reviews them before issuing.
	function onDraft() {
		const request = previewRequest.current;
		setDraftError(null);
		startDrafting(async () => {
			const result = await draftSignOffThemes({ suiteId });
			if (request !== previewRequest.current) return;
			if (!result.ok) {
				setDraftError(result.error);
				return;
			}
			setThemes((current) => [...current, ...result.data.themes].slice(0, THEME_LIMITS.maxThemes));
		});
	}

	function onOpenChange(next: boolean) {
		setOpen(next);
		if (!next) {
			previewRequest.current++;
			return;
		}
		setDraftId(draft?.id ?? null);
		setNote(draft?.note ?? "");
		setThemes(draft?.themes ?? []);
		setDraftError(null);
		setError(null);
		setReport(null);
		if (!blocker) loadPreview();
	}

	// Create sign-off happens on confirm: Create draft makes the record the first time.
	async function ensureDraft(): Promise<string | null> {
		if (draftId) return draftId;
		const created = await createSignOff({ suiteId });
		if (!created.ok) {
			setError(created.error);
			return null;
		}
		setDraftId(created.data.id);
		return created.data.id;
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const id = await ensureDraft();
			if (!id) return;
			const result = await saveSignOffDraft({ signOffId: id, note: note.trim(), themes });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			// The Sign-off tab opens the draft by default, so the vendor lands on the document being drafted.
			router.push(`/testsuite/${testSuiteSlug}/sign-off`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex flex-row items-center gap-2">
						<StampIcon className="size-5" />
						Sign-off report
					</DialogTitle>
					<DialogDescription className="text-xs flex flex-col gap-1">
						{latestCompleted ? (
							// Spans, not <p>: DialogDescription already renders a <p>.
							<>
								<span>
									Each case uses its latest result across all completed iterations carried over if not
									re-tested. Any organization failing it makes it Failed.
								</span>
							</>
						) : (
							"The client acknowledges it to close the suite."
						)}
					</DialogDescription>
				</DialogHeader>
				{blocker ? (
					<p className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3">{blocker}</p>
				) : (
					<div className="flex flex-col gap-4 overflow-y-auto -mx-1 px-1">
						{openUntestedCases > 0 && (
							<p className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3">
								{openUntestedCases} test case{openUntestedCases === 1 ? " has" : "s have"} no finished result yet (never tested in a completed round, or left untested). You can still issue the sign-off.
							</p>
						)}
						<UnsubmittedOrgsWarning organizations={latestCompleted?.unsubmittedOrgs ?? []} context="sign-off" />
						{report ? (
							<ReportPreview report={report} />
						) : isLoadingReport ? (
							<div className="flex flex-col gap-2" aria-label="Loading report preview">
								<Skeleton className="h-6 w-40" />
								<Skeleton className="h-24 w-full" />
								<Skeleton className="h-16 w-full" />
							</div>
						) : null}
						{/* {report && (
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-medium">
										Tester observations <span className="text-muted-foreground font-normal">(optional, {report.remarks?.length ?? 0} remark{report.remarks?.length === 1 ? "" : "s"} recorded)</span>
									</p>
									{aiDraftAvailable && (report.remarks?.length ?? 0) > 0 && (
										<Button
											variant="outline"
											size="sm"
											onClick={onDraft}
											disabled={isPending || isDrafting || themes.length >= THEME_LIMITS.maxThemes}
										>
											<SparklesIcon />
											{isDrafting ? "Drafting…" : "Draft with AI"}
										</Button>
									)}
								</div>
								{draftError && <p className="text-xs text-destructive">{draftError}</p>}
								<SignOffThemeEditor remarks={report.remarks ?? []} themes={themes} onChange={setThemes} disabled={isPending || isDrafting} />
							</div>
						)} */}
						<div className="flex flex-col gap-2">
							<Label htmlFor="sign-off-note" className="text-xs">
								Note <span className="text-muted-foreground font-normal">(optional{hasExceptions ? ", recommended with exceptions" : ""})</span>
							</Label>
							<Textarea
								id="sign-off-note"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder={hasExceptions ? "e.g. Accepted with 2 known issues tracked for the next release" : "Anything worth recording with the sign-off"}
								disabled={isPending}
								className="text-xs"
							/>
						</div>
					</div>
				)}
				{error && <p className="text-xs text-destructive">{error}</p>}
				{incompleteThemes > 0 && (
					<p className="text-xs text-amber-700">
						{incompleteThemes} observation{incompleteThemes === 1 ? " is" : "s are"} incomplete. Each needs a title and at least one cited remark that still exists, or remove it.
					</p>
				)}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Close</DialogClose>
					{!blocker && (!report || error === STALE_REMARK_ERROR) && !isLoadingReport ? (
						<Button variant="outline" onClick={() => loadPreview()}>Retry preview</Button>
					) : (
						<Button onClick={onSave} disabled={isPending || isDrafting || !!blocker || !report}>
							{isPending ? "Creating…" : "Create draft"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function formatCriterionValue(criterion: CriterionResult, value: number | string) {
	return criterion.key === "minPassRate" && typeof value === "number" ? `${value}%` : String(value);
}

// What gets frozen on issue: verdict, criteria scorecard, totals and limitations.
// Totals are one final status per case, rolled up across every completed round.
function ReportPreview({ report }: { report: SignOffReport }) {
	const { totals, header } = report;
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs font-medium">Exit criteria</p>
				{report.verdict === "met" ? (
					<Badge className="bg-green-100 text-green-800">Met</Badge>
				) : (
					<Badge variant="destructive">Not met</Badge>
				)}
			</div>
			<ul className="flex flex-col divide-y rounded-md border text-sm">
				{report.criteria.map((criterion) => (
					<li key={criterion.key} className="flex items-center gap-2 p-2">
						{criterion.met ? (
							<CheckIcon className="size-4 shrink-0 text-green-700" aria-label="Met" />
						) : (
							<XIcon className="size-4 shrink-0 text-destructive" aria-label="Not met" />
						)}
						<span className="flex-1 text-xs">{criterion.label}</span>
						<span className="font-mono text-xs text-muted-foreground">
							{formatCriterionValue(criterion, criterion.actual)} / {formatCriterionValue(criterion, criterion.threshold)}
						</span>
					</li>
				))}
			</ul>
			<p className="text-xs text-muted-foreground">
				These results are used to determine if the exit criteria are met.
			</p>
			<p className="text-xs font-medium">
				Latest Reults Summary
			</p>
			<div className="grid grid-cols-5 gap-2 text-center">
				{([
					["Cases", totals.total, ""],
					["Passed", totals.passed, "text-green-800"],
					["Failed", totals.failed, "text-red-800"],
					["Blocked", totals.blocked, ""],
					["Not tested", totals.untested + totals.inProgress, "text-muted-foreground"],
				] as const).map(([label, value, className]) => (
					<div key={label} className="border rounded-md p-2">
						<p className={`font-mono font-semibold text-lg ${className}`}>{value}</p>
						<p className="text-xs text-muted-foreground">{label}</p>
					</div>
				))}
			</div>
			<p className="text-xs font-medium text-muted-foreground">
				These totals are the final status per case, rolled up across every completed round.
			</p>
			{report.limitations.length > 0 && (
				<div className="flex flex-col gap-1">
					<p className="text-xs font-medium">Limitations</p>
					<ul className="flex flex-col gap-1 text-sm list-disc pl-5">
						{report.limitations.map((limitation) => (
							<li className="text-xs" key={limitation.key}>
								{limitation.text}
								{limitation.items.length > 0 && (
									<span className="text-muted-foreground ">
										{": "}
										{limitation.items.slice(0, 3).join(", ")}
										{limitation.items.length > 3 && ` and ${limitation.items.length - 3} more`}
									</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

// Step 2 of sign-off (client): acknowledge the vendor's issued sign-off, closing the suite.
// reportHref: the frozen report's page; null for sign-offs issued before reports existed.
export function AcknowledgeSignOffDialog({ suiteId, signOff, reportHref, trigger }: { suiteId: string; signOff: signOff; reportHref: string | null; trigger: React.ReactElement }) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const counts = signOff.exceptions;

	function onAcknowledge() {
		setError(null);
		startTransition(async () => {
			const result = await acknowledgeSignOff({ suiteId });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setError(null); }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Acknowledge sign-off</DialogTitle>
					<DialogDescription>
						{signOff.signedOffBy ?? "The vendor"} issued the sign-off based on {signOff.iterationName}. Acknowledging it closes the suite.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					{reportHref && (
						<div className="flex items-center justify-between gap-3 rounded-md border p-3">
							<p className="text-sm">Read the sign-off report before acknowledging: verdict, failed cases, round history and limitations.</p>
							{/* New tab, so the dialog stays open to acknowledge afterwards. */}
							<Button variant="outline" size="sm" nativeButton={false} render={<Link href={reportHref} target="_blank" rel="noopener" />}>
								<FileTextIcon />
								Open report
							</Button>
						</div>
					)}
					<div className="grid grid-cols-5 gap-2 text-center">
						{([
							["Total", counts.total, ""],
							["Passed", counts.passed, "text-green-800"],
							["Failed", counts.failed, "text-red-800"],
							["Blocked", counts.blocked, ""],
							["Not tested", counts.untested + counts.inProgress, "text-muted-foreground"],
						] as const).map(([label, value, className]) => (
							<div key={label} className="border rounded-md p-2">
								<p className={`font-mono font-semibold text-lg ${className}`}>{value}</p>
								<p className="text-xs text-muted-foreground">{label}</p>
							</div>
						))}
					</div>
					{/* {signOff.note && (
						<div className="flex flex-col gap-1">
							<Label>Vendor note</Label>
							<p className="text-sm">{signOff.note}</p>
						</div>
					)} */}
				</div>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button onClick={onAcknowledge} disabled={isPending}>
						{isPending ? "Acknowledging…" : "Acknowledge & close suite"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// The client's other answer to an issued sign-off: reject it with a reason. The suite stays locked
// until the vendor reopens testing or creates a new report.
export function RejectSignOffDialog({ suiteId, signOff, trigger }: { suiteId: string; signOff: signOff; trigger: React.ReactElement }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onReject() {
		setError(null);
		startTransition(async () => {
			const result = await rejectSignOff({ suiteId, reason });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setReason(""); setError(null); } }}>
			<DialogTrigger render={trigger} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Reject sign-off</DialogTitle>
					<DialogDescription>
						{signOff.signedOffBy ?? "The vendor"} issued the sign-off based on {signOff.iterationName}. Tell them why it can&apos;t be accepted; they can reopen testing or prepare a new report.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="reject-reason" className="text-xs">Reason</Label>
					<Textarea
						id="reject-reason"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="e.g. Claims approval still fails for Company A; retest after the fix"
						disabled={isPending}
						className="text-xs"
					/>
				</div>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button variant="destructive" onClick={onReject} disabled={isPending || !reason.trim()}>
						{isPending ? "Rejecting…" : "Reject sign-off"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
