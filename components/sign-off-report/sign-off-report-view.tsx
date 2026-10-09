import { CheckIcon, CircleCheck, CircleDashed, CircleOff, CircleX, ClipboardIcon, LucideIcon, SkipForward, UserGroup, XIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatTimestamp } from "@/lib/utils";
import type { statusCounts } from "@/lib/supabase/overview";
import type { Breakdown, CaseAuditEntry, ExecutedStatus, FrozenSignOffReport, CriterionResult, SignOffReport } from "@/lib/supabase/sign-off-report";
import { groupRemarks, type ReportRemark } from "@/lib/report/sign-off-remarks";
import { ParticipantsTable } from "./participants-table";
import { VerdictTable } from "./verdict-table";
import { RoundTable } from "./round-table";
import { ChangeListTable, type ChangeListItem } from "./change-list-table";
import TestCasesIndexPage from "@/app/(app)/testsuite/[testSuiteSlug]/test-cases/page";
import { CaseResultsTable } from "./case-results-table";
import { ReportSectionContent, ReportSectionsEditor } from "./report-sections-editor";
import type { OverviewTemplate } from "@/lib/report/report-details";

// The body of a frozen sign-off report (suite_sign_offs.report). Every number comes from the
// report jsonb, never from live data. No "use client": rendered from Server Components.

const STATUS_STYLES = {
	Passed: { bar: "bg-green-600", text: "text-green-800", badge: "bg-green-100 text-green-800" },
	Failed: { bar: "bg-red-600", text: "text-red-800", badge: "bg-red-100 text-red-800" },
	Blocked: { bar: "bg-amber-500", text: "text-amber-800", badge: "bg-amber-100 text-amber-800" },
	"Not tested": { bar: "bg-stone-300", text: "text-muted-foreground", badge: "bg-stone-100 text-stone-700" },
} as const;

const PRIORITY_STYLES = { high: "bg-red-50 text-red-800", medium: "bg-amber-50 text-amber-800", low: "bg-stone-100 text-stone-700" } as const;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const caseLabel = (c: { code: string | null; title: string }) => (c.code ? `${c.code} ${c.title}` : c.title);

export function SignOffReportView({ frozen }: { frozen: FrozenSignOffReport }) {
	const { report } = frozen;
	return (
		<>
			<ReportHeaderSection frozen={frozen} />
			<VerdictSection report={report} />
			<RoundHistorySection report={report} />
			<ResultsSection report={report} />
			{/* <FailedCasesSection report={report} /> */}
			{/* <LimitationsSection report={report} /> */}
			{/* <ObservationsSection report={report} /> */}
			<RemarksSection report={report} />
		</>
	);
}

// The same sections as SignOffReportView, one per document sheet (Sign-off tab). Keep the two in step.
// Navigation labels for reportPages, in the same order (one per sheet).
export const REPORT_SECTIONS = ["Report details", "Testing outcome", "Iteration history", "Results overview", "Remarks"];

// A section with nothing to report is null: the document leaves it off the paper and disables its nav entry.
// templates: Overview content the draft's Add section menu can copy in (draft only).
export function reportPages(frozen: FrozenSignOffReport, { draft = false, templates = [] }: { draft?: boolean; templates?: OverviewTemplate[] } = {}): (React.ReactNode | null)[] {
	const { report } = frozen;
	return [
		<ReportHeaderSection key="header" frozen={frozen} draft={draft} templates={templates} />,
		<VerdictSection key="verdict" report={report} />,
		report.roundHistory.rounds.length > 0 ? <RoundHistorySection key="round_history" report={report} /> : null,
		report.totals.total > 0 ? <ResultsSection key="results" report={report} /> : null,
		// report.failedCases.length > 0 ? <FailedCasesSection key="failed_cases" report={report} /> : null,
		(report.remarks ?? []).length > 0 ? <RemarksSection key="remarks" report={report} /> : null,
	];
}

function Section({ title, description, className, children }: { title: string; description?: string; className?: string; children: React.ReactNode }) {
	return (
		<section className={cn("flex flex-col gap-4", className)}>
			<div className="flex flex-col gap-1 pb-2 print:break-after-avoid">
				<h2 className="text-lg font-semibold">{title}</h2>
				{description && <p className="text-xs text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}

// a. Header ------------------------------------------------------------------

// draft: the vendor's unissued preview, so there's no issuer, issue date or acknowledgement yet.
// The vendor's own sections (report.sections) follow the participants; on the draft they can be added
// (blank or copied from the Overview), edited, moved and removed.
// The version's state (draft, rejection reason, withdrawn) shows in SignOffNotice above the paper, not here.
export function ReportHeaderSection({ frozen, draft = false, templates = [] }: { frozen: FrozenSignOffReport; draft?: boolean; templates?: OverviewTemplate[] }) {
	const { header } = frozen.report;
	const sections = frozen.report.sections ?? [];
	return (
		<header className="flex flex-col gap-6">
			<div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 flex-col gap-1">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">test suite report</p>
					<h1 className="text-xl font-semibold break-words sm:text-2xl">
						{header.suiteCode && <span className="font-mono text-muted-foreground">{header.suiteCode} · </span>}
						{header.suiteName}
					</h1>
				</div>
				{draft ? null : frozen.rejectedAt ? (
					<HeaderItem label="Rejected" value={`${formatTimestamp(frozen.rejectedAt)}${frozen.rejectedBy ? ` by ${frozen.rejectedBy}` : ""}`} />
				) : (
					<HeaderItem
						label="Acknowledged"
						value={frozen.acknowledgedAt ? `${formatTimestamp(frozen.acknowledgedAt)}${frozen.acknowledgedBy ? ` by ${frozen.acknowledgedBy}` : ""}` : "Awaiting acknowledgement"}
					/>
				)}
			</div>
			<dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-8 text-sm sm:grid-cols-4">
				<HeaderItem label="Issued by" value={draft ? "Not issued yet" : frozen.signedOffBy ?? "Unknown"} />
				<HeaderItem label="Issued On" value={draft ? "Not issued yet" : formatTimestamp(frozen.signedOffAt)} />
				<HeaderItem label="Testing Started" value={formatTimestamp(header.roundStartedAt)} />
				<HeaderItem label="Testing End" value={formatTimestamp(header.roundCompletedAt)} />
			</dl>
			{header.participants.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">Participants</p>
					<ParticipantsTable participants={header.participants} />
				</div>
			)}
			{draft ? (
				<ReportSectionsEditor signOffId={frozen.signOffId} sections={sections} templates={templates} />
			) : (
				sections.map((section) => <ReportSectionContent key={section.id} section={section} />)
			)}
			{frozen.note && (
				<div className="flex flex-col gap-1 rounded-md border p-3 print:break-inside-avoid">
					<p className="text-xs font-semibold text-muted-foreground">Development Team note</p>
					<p className="whitespace-pre-wrap break-words text-sm">{frozen.note}</p>
				</div>
			)}
		</header>
	);
}

function HeaderItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="font-medium break-words text-sm">{value}</dd>
		</div>
	);
}

// b. Verdict and scorecard ---------------------------------------------------

function formatCriterionValue(criterion: CriterionResult, value: number | string) {
	return criterion.key === "minPassRate" && typeof value === "number" ? `${value}%` : String(value);
}

// How each criterion was decided: a one-line summary, then the working behind it
// (formula, margin, and what fell short). Built from the frozen report, so old reports get it too.
const countOf = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function explainCriterion(criterion: CriterionResult, report: SignOffReport): { summary: string; details: string[] } {
	const { key, actual, threshold, met } = criterion;
	const t = report.totals;
	const notTested = t.untested + t.inProgress;
	switch (key) {
		case "minPassRate": {
			const required = Number(threshold);
			const neededPasses = Math.ceil((required / 100) * t.total);
			const gap = Math.round(Math.abs(report.passRate - required) * 10) / 10;
			return {
				summary: `${t.passed} of ${countOf(t.total, "test case")} passed, a pass rate of ${actual}% against the required ${required}%.`,
				details: [
					`Pass rate = passed ÷ every test case in scope. The other ${t.total - t.passed} count against it: ${t.failed} failed, ${t.blocked} blocked, ${notTested} not tested.`,
					met
						? `Cleared the bar by ${gap} percentage point${gap === 1 ? "" : "s"}.`
						: `Fell short by ${gap} percentage point${gap === 1 ? "" : "s"}; at least ${countOf(neededPasses, "pass")} (${neededPasses - t.passed} more) were needed.`,
					"Each test case counts once, using its final result across the completed rounds.",
				],
			};
		}
		case "maxFailed":
		case "maxBlocked": {
			const word = key === "maxFailed" ? "failed" : "blocked";
			const count = Number(actual);
			const limit = Number(threshold);
			return {
				summary: `${countOf(count, "test case")} ${count === 1 ? "was" : "were"} ${word}, against a limit of ${limit}.`,
				details: [
					`Counted from each test case's final result, out of ${countOf(t.total, "test case")} in scope.`,
					met
						? count === limit
							? `Exactly at the limit; one more ${word} case would have missed it.`
							: `Within the limit, with room for ${limit - count} more.`
						: `${count - limit} over the limit; those ${word} cases had to be resolved for this to be met.`,
				],
			};
		}
		case "requireAllOrgsSubmitted": {
			// Rounds frozen before participants were recorded don't carry this breakdown.
			const rounds = report.roundHistory.rounds.filter((r) => r.participants);
			const details = rounds.map((round) => {
				const expected = round.participants!.filter((p) => !p.withdrawnAt);
				const missing = expected.filter((p) => !p.submittedAt).map((p) => p.organizationName);
				return `${round.name}: ${expected.length - missing.length} of ${expected.length} submitted${missing.length ? `, missing ${missing.join(", ")}` : ""}.`;
			});
			return {
				summary: met
					? `Every participating organization submitted its results in every round (${actual}).`
					: `Only ${actual} expected submissions came in; every organization has to submit, in every round.`,
				details: [...details, "Organizations that withdrew from a round aren't expected to submit for it."],
			};
		}
		default:
			return { summary: `Actual ${formatCriterionValue(criterion, actual)} against a required ${formatCriterionValue(criterion, threshold)}.`, details: [] };
	}
}

function VerdictSection({ report }: { report: SignOffReport }) {
	const met = report.verdict === "met";
	return (
		<Section title="Testing Outcome" description="Measured against the exit criteria set for this suite before testing started.">
			<div className={cn("flex flex-row items-center gap-6 md:gap-3 rounded-md border p-4 sm:items-center print:break-inside-avoid", met ? "border-green-700/30 bg-green-50" : "border-red-700/30 bg-red-50")}>
				{met ? <CheckIcon className="size-6 shrink-0 text-green-700" /> : <XIcon className="size-6 shrink-0 text-red-700" />}
				<div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
					<p className={cn("text-lg font-semibold", met ? "text-green-800" : "text-red-800")}>Exit criteria {met ? "met" : "not met"}</p>
					<p className={`text-xs ${met ? "text-green-700" : "text-red-700"}`}>
						<span className="font-mono font-semibold">{report.criteria.filter((c) => c.met).length}</span> of <span className="font-mono font-semibold">{report.criteria.length}</span> criteria met · pass rate <span className="font-mono">{report.passRate}%</span>
					</p>
				</div>
			</div>
			<div className="print:break-after-avoid">
				<p className="text-sm font-semibold">Testing Criteria</p>
				<p className="text-xs text-muted-foreground">Set of criteria used to evaluate the test results.</p>
			</div>
			<VerdictTable criteria={report.criteria} />

			<div className="flex flex-col gap-4">
				{report.criteria.map((criterion, index) => {
					const { summary, details } = explainCriterion(criterion, report);
					return (
						<div key={criterion.key} className={cn("flex flex-col gap-1 border rounded-md print:break-inside-avoid", criterion.met ? "border-green-900" : "border-red-900")}>
							<div className={cn("flex flex-col text-white rounded-t-md p-4", criterion.met ? "bg-green-900" : "bg-red-900")}>
								<p className="text-xs font-mono uppercase">Criterion {index + 1}: {criterion.label}</p>
								<p className="font-semibold text-sm md:text-lg">{summary}</p>
							</div>
							<div className="p-4">
								{details.length > 0 && (
									<ul className="list-disc pl-4 text-sm flex flex-col gap-1">
										{details.map((detail) => <li key={detail}>{detail}</li>)}
									</ul>
								)}
							</div>
						</div>
					);
				})}
			</div>

		</Section>
	);
}

// c. Results overview and breakdowns -----------------------------------------

function segmentsOf(counts: statusCounts) {
	return [
		{ label: "Passed", value: counts.passed },
		{ label: "Failed", value: counts.failed },
		{ label: "Blocked", value: counts.blocked },
		{ label: "Not tested", value: counts.untested + counts.inProgress },
	] as const;
}

// Stacked CSS bar, one segment per status.
function StatusBar({ counts, className }: { counts: statusCounts; className?: string }) {
	return (
		<div className={cn("flex h-3 w-full overflow-hidden rounded-sm bg-muted", className)} role="img" aria-label={segmentsOf(counts).map((s) => `${s.value} ${s.label}`).join(", ")}>
			{counts.total > 0 &&
				segmentsOf(counts)
					.filter((s) => s.value > 0)
					.map((s) => <div key={s.label} className={STATUS_STYLES[s.label].bar} style={{ width: `${(s.value / counts.total) * 100}%` }} />)}
		</div>
	);
}

function ResultsSection({ report }: { report: SignOffReport }) {
	const { totals, breakdowns } = report;
	const percentOf = (value: number) => (totals.total === 0 ? 0 : Math.round((value / totals.total) * 1000) / 10);
	const notTested = totals.untested + totals.inProgress;
	const shortfall = [
		totals.failed > 0 && `${totals.failed} failed`,
		totals.blocked > 0 && `${totals.blocked} blocked`,
		notTested > 0 && `${notTested} not tested`,
	].filter(Boolean);
	return (
		<Section
			title="Results overview"
			description="One final status per test case, rolled up across every completed round. Each organization's latest executed result counts; any Failed makes the case Failed."
			className="print:break-before-page"
		>
			<div className="flex flex-col gap-4">
				{totals.total === 0 ? (
					<p className="text-sm text-muted-foreground">No test cases were in scope for this sign-off.</p>
				) : (
					<div className="flex flex-col gap-2">
						<p className="text-sm font-semibold">
							<span className="font-mono font-semibold">{totals.passed}</span> of {plural(totals.total, "test case")} passed, a{" "}
							<span className="font-mono font-semibold">{report.passRate}%</span> pass rate.
						</p>
						<p className="text-xs text-muted-foreground">
							The pass rate is the share of every case in scope that ended Passed, so cases that failed, were blocked or were never run all count
							against it.{" "}
							{shortfall.length === 0
								? "Every case in scope was run and passed."
								: `${shortfall.join(", ").replace(/, ([^,]*)$/, " and $1")} kept it from reaching 100%.`}
						</p>
					</div>
				)}
				<div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5 print:break-inside-avoid">
					<div className="rounded-md border p-3">
						<p className="font-mono text-2xl font-semibold">{totals.total}</p>
						<p className="text-xs text-muted-foreground">Test cases</p>
						<p className="mt-1 font-mono text-xs text-muted-foreground">in scope</p>
					</div>
					{segmentsOf(totals).map((s) => (
						<div key={s.label} className="rounded-md border p-3">
							<p className={cn("font-mono text-2xl font-semibold", STATUS_STYLES[s.label].text)}>{s.value}</p>
							<p className="text-xs text-muted-foreground">{s.label}</p>
							<p className="mt-1 font-mono text-xs text-muted-foreground">{percentOf(s.value)}%</p>
						</div>
					))}
				</div>
				<p className="text-xs text-muted-foreground">
					These counts are per test case, not per organization. A case counts as Failed if any organization failed it, and as Blocked if any
					organization was blocked and none failed, so the per-organization numbers won&apos;t add up to these totals.
				</p>
			</div>
			<ResultsDistribution report={report} />
			{/* <StatusBar counts={totals} className="h-4" /> */}
			{/* <div className="flex flex-row flex-wrap gap-4 text-xs text-muted-foreground">
				{segmentsOf(totals).map((s) => (
					<span key={s.label} className="flex flex-row items-center gap-1.5">
						<span className={cn("size-2.5 rounded-sm", STATUS_STYLES[s.label].bar)} />
						{s.label}
					</span>
				))}
			</div>
			<div className="flex flex-col gap-4">
				<BreakdownTable title="By organization" rows={breakdowns.byOrg} note="Each organization's own result per case." icon={UserGroup} />
				<BreakdownTable title="By section" rows={breakdowns.bySection} note="Each Section of the given test suite" icon={ClipboardIcon} />
			</div> */}
		</Section>
	);
}

function ResultsDistribution({ report }: { report: SignOffReport }) {
	const cases = report.caseResults;
	// Same org order as the breakdowns; fall back to first appearance for any org missing there.
	const orgs = [...new Set([...report.breakdowns.byOrg.map((r) => r.label), ...(cases ?? []).flatMap((c) => c.perOrg.map((o) => o.organizationName))])];
	return (
		<div className="flex flex-col gap-2">
			<p className="text-sm font-semibold">Results distribution</p>
			<p className="text-xs text-muted-foreground">
				Each row is one test case. <span className="font-medium text-foreground">Final</span> is the combined result counted in the totals above;
				each organization column shows that organization&apos;s latest executed result and the round it came from. A dash means the case
				wasn&apos;t part of that organization&apos;s rounds.
			</p>
			{!cases ? (
				<p className="text-sm text-muted-foreground">Per-case results aren&apos;t available for reports issued before this view was added.</p>
			) : cases.length === 0 ? (
				<p className="text-sm text-muted-foreground">No test cases were in scope for this sign-off.</p>
			) : (
				<CaseResultsTable cases={cases} orgs={orgs} />
			)}
		</div>
	);
}

function BreakdownTable({ title, rows, note, icon }: { title: string; rows: Breakdown; note?: string, icon?: LucideIcon }) {
	const Icon = icon;
	return (
		<div className="flex flex-col print:break-inside-avoid border rounded-md">
			<div className="flex flex-col gap-1 p-4 bg-gray-50 dark:bg-gray-800 border-b sm:flex-row sm:justify-between">
				<div className="flex flex-row items-center gap-2">
					{Icon && <Icon className="size-4" />}
					<p className="text-sm font-semibold">{title}</p>
				</div>
				{note && <p className="text-xs text-muted-foreground">{note}</p>}
			</div>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">No data.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{rows.map((row) => (
						<li key={row.label} className="flex flex-col gap-1 last:border-b-0 border-b border-gray-200 dark:border-gray-700 p-4">
							<div className="flex flex-row items-baseline justify-between gap-2 text-sm">
								<span className="truncate text-xs">{row.label}</span>
								<span className="shrink-0 font-mono text-xs text-muted-foreground">
									{row.counts.passed}/{row.counts.total} passed
									{row.counts.failed > 0 && <span className="text-red-800"> · {row.counts.failed} failed</span>}
									{row.counts.blocked > 0 && <span className="text-amber-800"> · {row.counts.blocked} blocked</span>}
								</span>
							</div>
							<StatusBar counts={row.counts} className="h-2" />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

// d. Failed and blocked cases ------------------------------------------------

function FailedCasesSection({ report }: { report: SignOffReport }) {
	return (
		<Section
			title="Failed and blocked cases"
			description="High priority first. The steps and tester remarks behind each organization's result."
			className="print:break-before-page"
		>
			{report.failedCases.length === 0 ? (
				<p className="text-sm text-muted-foreground">No test case ended Failed or Blocked.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[30%]">Test case</TableHead>
							<TableHead>Priority</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="w-[45%]">Where it failed</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{report.failedCases.map((c) => (
							<TableRow key={c.testCaseId} className="align-top print:break-inside-avoid">
								<TableCell className="whitespace-normal">
									<p className="font-medium">{caseLabel(c)}</p>
									<p className="text-xs text-muted-foreground">
										{c.section}
										{c.roleAssignee && ` · ${c.roleAssignee}`}
									</p>
								</TableCell>
								<TableCell>
									<Badge className={cn("capitalize", PRIORITY_STYLES[c.priority])}>{c.priority}</Badge>
								</TableCell>
								<TableCell>
									<Badge className={STATUS_STYLES[c.status].badge}>{c.status}</Badge>
								</TableCell>
								<TableCell className="whitespace-normal">
									<div className="flex flex-col gap-3">
										{c.orgs.map((org) => (
											<div key={org.organizationName} className="flex flex-col gap-1">
												<p className="text-xs font-semibold">
													{org.organizationName} · <span className={STATUS_STYLES[org.status].text}>{org.status}</span> in {org.roundName}
												</p>
												{org.failedSteps.length === 0 ? (
													<p className="text-xs text-muted-foreground">No step marked {org.status.toLowerCase()}.</p>
												) : (
													<ol className="flex list-decimal flex-col gap-1 pl-4 text-xs">
														{org.failedSteps.map((step, i) => (
															<li key={i}>
																<span>{step.step}</span>
																{step.remarks.map((remark, j) => (
																	<blockquote key={j} className="mt-0.5 border-l-2 pl-2 text-muted-foreground italic">
																		{remark}
																	</blockquote>
																))}
															</li>
														))}
													</ol>
												)}
											</div>
										))}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</Section>
	);
}

// e. Round history -----------------------------------------------------------

function RoundHistorySection({ report }: { report: SignOffReport }) {
	const { rounds, regressions, fixes, failedEveryRound, caseAudit } = report.roundHistory;
	// Each case's runs ordered by iteration, oldest first, for the Testing History chips.
	const roundOrder = new Map(rounds.map((r, i) => [r.name, i]));
	const runsOf = (testCaseId: string) =>
		caseAudit?.find((c) => c.testCaseId === testCaseId)?.runs
			.slice()
			.sort((a, b) => (roundOrder.get(a.roundName) ?? 0) - (roundOrder.get(b.roundName) ?? 0));
	return (
		<Section title="Iteration history" description="Completed iteration, oldest first. Counts are one entry per case per organization." className="print:break-before-page gap-6">
			<RoundTable rounds={rounds} />
			<div className="flex flex-col gap-1">
				<p className="text-sm font-semibold">Test case audit</p>
				<p className="text-xs text-muted-foreground">Each test case&apos;s result in every iteration it ran in, across all participating organizations.</p>
			</div>
			{rounds.length > 1 && fixes.length + regressions.length + failedEveryRound.length === 0 && (
				<p className="text-sm text-muted-foreground">No test case was fixed, regressed or failed every iteration it ran in.</p>
			)}
			{rounds.length > 1 && fixes.length + regressions.length + failedEveryRound.length > 0 && (
				<div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700">
					<ChangeList
						title="Fixed"
						description="Failed, then Passed on the next run"
						items={fixes.map((c) => ({ key: `${c.testCaseId}-${c.toRound}`, label: caseLabel(c), detail: `${c.fromRound} → ${c.toRound}`, runs: runsOf(c.testCaseId) }))}
					/>
					<ChangeList
						title="Regressed"
						description="Passed, then Failed on the next run"
						items={regressions.map((c) => ({ key: `${c.testCaseId}-${c.toRound}`, label: caseLabel(c), detail: `${c.fromRound} → ${c.toRound}`, runs: runsOf(c.testCaseId) }))}
					/>
					<ChangeList
						title="Failed every round"
						description="Run in 2 or more rounds, never passed"
						items={failedEveryRound.map((c) => ({ key: c.testCaseId, label: caseLabel(c), detail: plural(c.roundCount, "round"), runs: runsOf(c.testCaseId) }))}
					/>
				</div>
			)}
		</Section>
	);
}

const AUDIT_STATUS_CLASS: Record<ExecutedStatus, string> = {
	Passed: "text-green-800 bg-green-500/10",
	Failed: "text-red-800 bg-red-500/10",
	Blocked: "text-gray-800 bg-gray-500/10",
};

// How a case moved across the rounds it ran in, read from its first and last runs.
function auditChange(runs: CaseAuditEntry["runs"]): { label: string; className: string } {
	const statuses = runs.map((run) => run.status);
	const last = statuses[statuses.length - 1];
	if (statuses.length === 1) return { label: "Single run", className: "text-muted-foreground" };
	if (statuses.every((s) => s === "Failed")) return { label: "Failed every round", className: "text-red-800" };
	if (statuses.every((s) => s === last)) return { label: "Consistent", className: "text-muted-foreground" };
	if (last === "Passed") return { label: "Fixed", className: "text-green-800" };
	if (statuses.includes("Passed")) return { label: "Regressed", className: "text-red-800" };
	return { label: "Changed", className: "text-amber-700" };
}

// Every executed case's result in each completed round, oldest first. "—" means the case
// wasn't run in that round. The table scrolls sideways on phones rather than squeezing.
function CaseAuditTable({ rounds, cases }: { rounds: string[]; cases: CaseAuditEntry[] }) {
	return (
		<div className="flex flex-col gap-2 print:break-before-page">

			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="bg-gray-50 pl-4 text-xs">Test case</TableHead>
							{rounds.map((round) => <TableHead key={round} className="bg-gray-50 text-xs whitespace-nowrap">{round}</TableHead>)}
							<TableHead className="bg-gray-50 pr-4 text-xs">Change</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{cases.map((c) => {
							const change = auditChange(c.runs);
							return (
								<TableRow key={c.testCaseId} className="print:break-inside-avoid">
									<TableCell className="pl-4 min-w-48 max-w-80 whitespace-normal">
										<p className="text-xs font-medium break-words">{caseLabel(c)}</p>
									</TableCell>
									{rounds.map((round) => {
										const run = c.runs.find((r) => r.roundName === round);
										return (
											<TableCell key={round}>
												{run
													? <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", AUDIT_STATUS_CLASS[run.status])}>{run.status}</span>
													: <span className="text-xs text-muted-foreground">—</span>}
											</TableCell>
										);
									})}
									<TableCell className="pr-4">
										<p className={cn("text-xs font-medium whitespace-nowrap", change.className)}>{change.label}</p>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

// Hidden when it has no items: the report only lists the changes that happened.
function ChangeList({ title, description, items }: { title: string; description: string; items: ChangeListItem[] }) {
	if (items.length === 0) return null;
	return (
		<div className="flex flex-col print:break-inside-avoid">
			<div className="flex gap-1 p-4 bg-gray-50 dark:bg-gray-800 border-b flex-row items-center justify-between">
				<p className="text-sm font-semibold">
					{title}
				</p>
				<p className="text-xs">{description}</p>
			</div>
			<ChangeListTable items={items} />
		</div>
	);
}

// f. Limitations -------------------------------------------------------------

function LimitationsSection({ report }: { report: SignOffReport }) {
	return (
		<Section title="Limitations" description="What this report does not cover, or covers with caveats.">
			<ul className="flex list-disc flex-col gap-3 pl-5 text-sm">
				{report.limitations.map((limitation) => (
					<li key={limitation.key} className="print:break-inside-avoid">
						<p>{limitation.text}{limitation.items.length > 0 && ` (${limitation.items.length})`}</p>
						{limitation.items.length > 0 && (
							<ul className="mt-1 flex list-[circle] flex-col gap-0.5 pl-5 text-muted-foreground">
								{limitation.items.map((item) => <li key={item}>{item}</li>)}
							</ul>
						)}
					</li>
				))}
			</ul>
		</Section>
	);
}

// g. Tester observations and remarks -----------------------------------------
// Reports frozen before Phase 5 have no remarks or themes; both read as empty.

function remarkStatusStyle(status: string) {
	return status === "Passed" || status === "Failed" || status === "Blocked" ? STATUS_STYLES[status] : STATUS_STYLES["Not tested"];
}

// The step's result, in the same icon chip as the Test Results tab's result summary.
const STEP_CHIP: Record<string, { Icon: LucideIcon; className: string }> = {
	Passed: { Icon: CircleCheck, className: "bg-green-600/20 text-green-800" },
	Failed: { Icon: CircleX, className: "bg-red-600/20 text-red-800" },
	Blocked: { Icon: CircleOff, className: "bg-gray-600/20 text-gray-800" },
	Skipped: { Icon: SkipForward, className: "bg-gray-600/20 text-gray-800" },
	Untested: { Icon: CircleDashed, className: "bg-gray-600/5 text-muted-foreground" },
};

function StepStatusChip({ status }: { status: string }) {
	const { Icon, className } = STEP_CHIP[status] ?? STEP_CHIP.Untested;
	return (
		<div className={cn("flex shrink-0 flex-row items-center gap-1 rounded-md py-1 px-1.5 w-fit", className)}>
			<Icon size={15} />
			<p className="text-xs font-semibold">{status === "Untested" ? "Not tested" : status}</p>
		</div>
	);
}

function RemarkContext({ remark }: { remark: ReportRemark }) {
	return (
		<div className="flex flex-col gap-0.5">
			<p className="flex flex-row flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
				<span className="min-w-0 break-words">
					{remark.organizationName} · {remark.roundName} · Step {remark.stepNumber}: {remark.step}
				</span>
				<Badge className={cn("h-4 px-1.5 text-[10px]", remarkStatusStyle(remark.stepStatus).badge)}>{remark.stepStatus}</Badge>
			</p>
			{(remark.authorName || remark.createdAt) && (
				<p className="text-xs text-muted-foreground">
					<span className="font-medium text-foreground">{remark.authorName ?? "Unknown tester"}</span>
					{remark.createdAt && <> · {formatTimestamp(remark.createdAt)}</>}
				</p>
			)}
		</div>
	);
}

function ObservationsSection({ report }: { report: SignOffReport }) {
	const themes = report.themes?.items ?? [];
	if (themes.length === 0) return null;
	const remarksById = new Map((report.remarks ?? []).map((r) => [r.id, r]));
	return (
		<Section
			title="Tester observations"
			description="Written by the Development Team when issuing the sign-off. Each observation cites the tester remarks it is based on."
			className="print:break-before-page"
		>
			<ol className="flex flex-col gap-6">
				{themes.map((theme, i) => (
					<li key={theme.id} className="flex flex-col gap-2 print:break-inside-avoid">
						<p className="font-semibold">
							{i + 1}. {theme.title}
						</p>
						{theme.summary && <p className="whitespace-pre-wrap text-sm">{theme.summary}</p>}
						<ul className="flex flex-col gap-3">
							{theme.remarkIds.map((id) => {
								const remark = remarksById.get(id);
								if (!remark) return null;
								return (
									<li key={id} className="flex flex-col gap-1">
										<p className="text-sm font-medium">{caseLabel(remark)}</p>
										<RemarkContext remark={remark} />
										<blockquote className="border-l-2 pl-3 text-sm italic whitespace-pre-wrap break-words">{remark.remark}</blockquote>
									</li>
								);
							})}
						</ul>
					</li>
				))}
			</ol>
		</Section>
	);
}

function RemarksSection({ report }: { report: SignOffReport }) {
	const groups = groupRemarks(report.remarks ?? []);
	return (
		<Section
			title="Remarks"
			description="Every remark behind each test case's final result, verbatim, grouped by section and test case."
			className="print:break-before-page"
		>
			{groups.length === 0 ? (
				<p className="text-sm text-muted-foreground">No tester remarks were recorded.</p>
			) : (
				<div className="flex flex-col gap-6">
					{groups.map((group) => (
						<div key={group.section} className="flex flex-col gap-3">
							<div className="print:break-after-avoid">
								<p className="text-sm font-semibold">{group.section}</p>
								<p className="text-xs text-muted-foreground">Remarked {group.cases.length} test cases</p>
							</div>
							{group.cases.map((c) => (
								<div key={c.testCaseId} className="border rounded-md ">
									<div className="p-3 border-b bg-gray-500/10 justify-between flex flex-row items-center gap-2 print:break-after-avoid">
										<p className="text-sm font-medium">{caseLabel(c)}</p>
										<p className="text-xs text-muted-foreground">Remarked {c.remarks.length} times</p>
									</div>
									{
										c.remarks.map((remark) => (
											<div className="border-b last:border-b-0 print:break-inside-avoid" key={remark.id}>
												<div className="px-3 py-2 border-b flex flex-row items-center justify-between gap-3 bg-gray-200/10">
													<div className="min-w-0">
														<div className="text-xs font-medium text-muted-foreground">Remarked on:</div>
														<p className="text-sm break-words"><span className="font-mono">STEP {remark.stepNumber}:</span> {remark.step} <span className="text-xs text-muted-foreground"> - {remark.roundName}</span></p>
													</div>
													<StepStatusChip status={remark.stepStatus} />
												</div>
												<div className="flex flex-col gap-1 px-3 py-2">
													<div className="typeset text-sm break-words">
														<ReactMarkdown remarkPlugins={[remarkGfm]}>{remark.remark}</ReactMarkdown>
													</div>
													<p className="text-xs text-muted-foreground">
														<span className="font-medium text-foreground">{remark.authorName ?? "Unknown tester"}</span>
														{" · "}{remark.organizationName}
														{remark.createdAt && <> · {formatTimestamp(remark.createdAt)}</>}
													</p>
												</div>
											</div>
										))
									}
								</div>
							))} 
						</div>
					))}
				</div>
			)}
		</Section>
	);
}
