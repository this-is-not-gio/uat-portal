import { CheckIcon, CircleX, ClipboardIcon, LucideIcon, TrendingDown, UserGroup, Wrench, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatTimestamp } from "@/lib/utils";
import type { statusCounts } from "@/lib/supabase/overview";
import type { Breakdown, FrozenSignOffReport, CriterionResult, SignOffReport } from "@/lib/supabase/sign-off-report";
import { groupRemarks, type ReportRemark } from "@/lib/report/sign-off-remarks";
import { ParticipantsTable } from "./participants-table";
import { VerdictTable } from "./verdict-table";
import { RoundTable } from "./round-table";

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
			{/* <ResultsSection report={report} /> */}
			{/* <FailedCasesSection report={report} /> */}
			{/* <LimitationsSection report={report} /> */}
			<ObservationsSection report={report} />
			<RemarksSection report={report} />
		</>
	);
}

function Section({ title, description, className, children }: { title: string; description?: string; className?: string; children: React.ReactNode }) {
	return (
		<section className={cn("flex flex-col gap-4", className)}>
			<div className="flex flex-col gap-1 pb-2">
				<h2 className="text-lg font-semibold">{title}</h2>
				{description && <p className="text-xs text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}

// a. Header ------------------------------------------------------------------

function ReportHeaderSection({ frozen }: { frozen: FrozenSignOffReport }) {
	const { header } = frozen.report;
	return (
		<header className="flex flex-col gap-6">
			<div className="flex flex-row items-center justify-between gap-4">
				<div className="flex flex-col gap-1">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">test suite report</p>
					<h1 className="text-2xl font-semibold">
						{header.suiteCode && <span className="font-mono text-muted-foreground">{header.suiteCode} · </span>}
						{header.suiteName}
					</h1>
				</div>
				<HeaderItem
					label="Acknowledged"
					value={frozen.acknowledgedAt ? `${formatTimestamp(frozen.acknowledgedAt)}${frozen.acknowledgedBy ? ` by ${frozen.acknowledgedBy}` : ""}` : "Awaiting acknowledgement"}
				/>
			</div>
			{frozen.revokedAt && (
				<p className="rounded-md border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-800">
					This sign-off was withdrawn on {formatTimestamp(frozen.revokedAt)} when a new test iteration started. It is kept for the record.
				</p>
			)}
			<dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
				<HeaderItem label="Issued by" value={frozen.signedOffBy ?? "Unknown"} />
				<HeaderItem label="Issued On" value={formatTimestamp(frozen.signedOffAt)} />
				<HeaderItem label="Testing Started" value={formatTimestamp(header.roundStartedAt)} />
				<HeaderItem label="Testing End" value={formatTimestamp(header.roundCompletedAt)} />
			</dl>
			{header.participants.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-xs text-muted-foreground">Participants</p>
					<ParticipantsTable participants={header.participants} />
				</div>
			)}
			{frozen.note && (
				<div className="flex flex-col gap-1 rounded-md border p-3">
					<p className="text-xs font-semibold text-muted-foreground">Vendor note</p>
					<p className="whitespace-pre-wrap text-sm">{frozen.note}</p>
				</div>
			)}
		</header>
	);
}

function HeaderItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="font-medium">{value}</dd>
		</div>
	);
}

// b. Verdict and scorecard ---------------------------------------------------

function formatCriterionValue(criterion: CriterionResult, value: number | string) {
	return criterion.key === "minPassRate" && typeof value === "number" ? `${value}%` : String(value);
}

function VerdictSection({ report }: { report: SignOffReport }) {
	const met = report.verdict === "met";
	return (
		<Section title="Verdict" description="Measured against the exit criteria set for this suite before testing started.">
			<div className={cn("flex flex-row items-center gap-3 rounded-md border p-4", met ? "border-green-700/30 bg-green-50" : "border-red-700/30 bg-red-50")}>
				{met ? <CheckIcon className="size-6 text-green-700" /> : <XIcon className="size-6 text-red-700" />}
				<div className="flex flex-row items-center justify-between flex-1">
					<p className={cn("text-lg font-semibold", met ? "text-green-800" : "text-red-800")}>Exit criteria {met ? "met" : "not met"}</p>
					<p className={`text-sm text-muted-foreground ${met ? "text-green-700" : "text-red-700"}`}>
						<span className="font-mono font-semibold">{report.criteria.filter((c) => c.met).length}</span> of <span className="font-mono font-semibold">{report.criteria.length}</span> criteria met · pass rate <span className="font-mono">{report.passRate}%</span>
					</p>
				</div>
			</div>
			{/* <Table>
				<TableHeader>
					<TableRow>
						<TableHead>Criterion</TableHead>
						<TableHead className="text-right">Actual</TableHead>
						<TableHead className="text-right">Required</TableHead>
						<TableHead className="text-right">Result</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{report.criteria.map((criterion) => (
						<TableRow key={criterion.key} className="print:break-inside-avoid">
							<TableCell>{criterion.label}</TableCell>
							<TableCell className="text-right font-mono">{formatCriterionValue(criterion, criterion.actual)}</TableCell>
							<TableCell className="text-right font-mono">{formatCriterionValue(criterion, criterion.threshold)}</TableCell>
							<TableCell className="text-right">
								{criterion.met ? <Badge className="bg-green-100 text-green-800">Met</Badge> : <Badge variant="destructive">Not met</Badge>}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table> */}
			<VerdictTable criteria={report.criteria} />
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
	return (
		<Section
			title="Results overview"
			description="One final status per test case, rolled up across every completed round. Each organization's latest executed result counts; any Failed makes the case Failed."
			className="print:break-before-page"
		>
			<div className="grid grid-cols-5 gap-2 text-center">
				<div className="rounded-md border p-3">
					<p className="font-mono text-2xl font-semibold">{totals.total}</p>
					<p className="text-xs text-muted-foreground">Test cases</p>
				</div>
				{segmentsOf(totals).map((s) => (
					<div key={s.label} className="rounded-md border p-3">
						<p className={cn("font-mono text-2xl font-semibold", STATUS_STYLES[s.label].text)}>{s.value}</p>
						<p className="text-xs text-muted-foreground">{s.label}</p>
					</div>
				))}
			</div>
			<StatusBar counts={totals} className="h-4" />
			<div className="flex flex-row flex-wrap gap-4 text-xs text-muted-foreground">
				{segmentsOf(totals).map((s) => (
					<span key={s.label} className="flex flex-row items-center gap-1.5">
						<span className={cn("size-2.5 rounded-sm", STATUS_STYLES[s.label].bar)} />
						{s.label}
					</span>
				))}
			</div>
			<div className="flex flex-col gap-4">
				<BreakdownTable title="By organization" rows={breakdowns.byOrg} note="Each organization's own result per case." icon={UserGroup} />
				<BreakdownTable title="By section" rows={breakdowns.bySection} note="Each Section of the given test suite" icon={ClipboardIcon}/>
			</div>
		</Section>
	);
}

function BreakdownTable({ title, rows, note, icon }: { title: string; rows: Breakdown; note?: string, icon?: LucideIcon } ) {
	const Icon = icon;
	return (
		<div className="flex flex-col print:break-inside-avoid border rounded-md">
			<div className="flex flex-row justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b">
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
	const { rounds, regressions, fixes, failedEveryRound } = report.roundHistory;
	return (
		<Section title="Iteration history" description="Completed iteration, oldest first. Counts are one entry per case per organization." className="print:break-before-page">
			<RoundTable rounds={rounds} />
			{rounds.length > 1 && (
				<div className="border rounded-md divide-y divide-gray-200 dark:divide-gray-700">
					<ChangeList
						title="Fixed"
						description="Failed, then Passed on the next run"
						items={fixes.map((c) => ({ key: `${c.testCaseId}-${c.toRound}`, label: caseLabel(c), detail: `${c.fromRound} → ${c.toRound}` }))}
						empty={{ icon: Wrench, title: "No fixed cases", description: "No case failed and then passed on a later run." }}
					/>
					<ChangeList
						title="Regressed"
						description="Passed, then Failed on the next run"
						items={regressions.map((c) => ({ key: `${c.testCaseId}-${c.toRound}`, label: caseLabel(c), detail: `${c.fromRound} → ${c.toRound}` }))}
						empty={{ icon: TrendingDown, title: "No regressions", description: "No case passed and then failed on a later run." }}
					/>
					<ChangeList
						title="Failed every round"
						description="Run in 2 or more rounds, never passed"
						items={failedEveryRound.map((c) => ({ key: c.testCaseId, label: caseLabel(c), detail: plural(c.roundCount, "round") }))}
						empty={{ icon: CircleX, title: "No repeat failures", description: "No case failed in every round it was run." }}
					/>
				</div>
			)}
		</Section>
	);
}

function ChangeList({ title, description, items, empty }: { title: string; description: string; items: { key: string; label: string; detail: string }[]; empty: { icon: LucideIcon; title: string; description: string } }) {
	return (
		<div className="flex flex-col print:break-inside-avoid">
			<div className="flex flex-row items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b">
				<p className="text-sm font-semibold">
					{title} <span className="font-mono text-muted-foreground">({items.length})</span>
				</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			{items.length === 0 ? (
				<EmptyState icon={empty.icon} size="sm" title={empty.title} description={empty.description} />
			) : (
				<ul className="flex flex-col gap-1 text-sm">
					{items.map((item) => (
						<li key={item.key} className="flex flex-col py-2 px-4 border-b last:border-b-0 print:break-inside-avoid">
							<span>{item.label}</span>
							<span className="font-mono text-xs text-muted-foreground">{item.detail}</span>
						</li>
					))}
				</ul>
			)}
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

function RemarkContext({ remark }: { remark: ReportRemark }) {
	return (
		<p className="flex flex-row flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
			<span>
				{remark.organizationName} · {remark.roundName} · Step {remark.stepNumber}: {remark.step}
			</span>
			<Badge className={cn("h-4 px-1.5 text-[10px]", remarkStatusStyle(remark.stepStatus).badge)}>{remark.stepStatus}</Badge>
		</p>
	);
}

function ObservationsSection({ report }: { report: SignOffReport }) {
	const themes = report.themes?.items ?? [];
	if (themes.length === 0) return null;
	const remarksById = new Map((report.remarks ?? []).map((r) => [r.id, r]));
	return (
		<Section
			title="Tester observations"
			description="Written by the vendor when issuing the sign-off. Each observation cites the tester remarks it is based on."
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
										<blockquote className="border-l-2 pl-3 text-sm italic whitespace-pre-wrap">{remark.remark}</blockquote>
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
			title="Tester remarks"
			description="Every remark behind each test case's final result, verbatim, grouped by section and test case."
			className="print:break-before-page"
		>
			{groups.length === 0 ? (
				<p className="text-sm text-muted-foreground">No tester remarks were recorded.</p>
			) : (
				<div className="flex flex-col gap-6">
					{groups.map((group) => (
						<div key={group.section} className="flex flex-col gap-3">
							<p className="text-sm font-semibold">{group.section}</p>
							{group.cases.map((c) => (
								<div key={c.testCaseId} className="flex flex-col gap-2 rounded-md border p-3 print:break-inside-avoid">
									<div className="flex flex-row items-center gap-2">
										<p className="text-sm font-medium">{caseLabel(c)}</p>
									</div>
									<ul className="flex flex-col gap-2">
										{c.remarks.map((remark) => (
											<li key={remark.id} className="flex flex-col gap-0.5">
												<RemarkContext remark={remark} />
												<blockquote className="border-l-2 pl-3 text-sm whitespace-pre-wrap">{remark.remark}</blockquote>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					))}
				</div>
			)}
		</Section>
	);
}
