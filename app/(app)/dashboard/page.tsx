import { requireUser } from "@/lib/supabase/auth";
import { getSidebarSuites, type suiteStatus } from "@/lib/supabase/Init";
import { statusMapping } from "@/components/testsuite-layout/suite-status-badge";
import { cn } from "@/lib/utils";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveRounds, getRecentResults, getRoundsAwaitingSignOff, getRunningRoundStarts, getSignOffsAwaitingAck } from "@/lib/supabase/test-iterations";
import { BellRing, BookAlert, CalendarClock, CalendarRange, CircleAlert, CircleCheck, ClipboardList, Clock, FileSignature, FlaskConical, History, Hourglass, Send, SquarePen, Stamp } from "lucide-react";
import Link from "next/link";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
import { Badge } from "@/components/ui/badge";
import ActiveIterationTable from "@/components/dashboard/active-iteration-table";
import ActionItemsTable, { type ActionItemRow } from "@/components/dashboard/action-items-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import DismissibleNotice from "@/components/dashboard/dismissible-notice";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { TestingSchedule } from "@/components/dashboard/testing-schedule";


// Local copy of the TestStatusMapping colours: that map lives in a "use client" file, which a Server Component can't read values from.
const RESULT_TONE: Record<string, string> = { Passed: "text-green-700", Failed: "text-destructive", Blocked: "text-amber-700" };

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Archived is left out on purpose: the row tracks suites still moving through the lifecycle.
const PIPELINE: suiteStatus[] = ["draft", "ready", "in_testing", "for_sign_off"];
// "sign_off_issued", "sign_off_rejected", "signed_off"

// A pipeline card counts every suite still in its stage: the sign-off card also takes issued and rejected sign-offs (signed_off is done, so it drops out).
const STAGE_STATUSES: Partial<Record<suiteStatus, suiteStatus[]>> = {
	for_sign_off: ["for_sign_off", "sign_off_issued", "sign_off_rejected"],
};
const inStage = (stage: suiteStatus, status: suiteStatus) => (STAGE_STATUSES[stage] ?? [stage]).includes(status);

const TAGLINES: Partial<Record<suiteStatus, string>> = {
	draft: "Still on the drawing board",
	ready: "Locked, loaded, waiting for testers",
	in_testing: "Bug hunt in progress",
	for_sign_off: "Report in the works",
	// sign_off_issued: "Ball's in the client's court",
	// sign_off_rejected: "Sent back by the client",
	// signed_off: "Shipped it!",
};

// Urgent items (red tone) get a pinging dot at the end of the row; motion-safe keeps it still for reduced-motion users.
function UrgentPulse({ tone }: { tone: string }) {
	if (tone !== "text-destructive") return null;
	return (
		<span className="relative ml-auto flex size-2 shrink-0" aria-label="Urgent">
			<span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
			<span className="relative inline-flex size-2 rounded-full bg-destructive" />
		</span>
	);
}

// Dev-only sample rows (open /dashboard?mock=1) to preview every action type without touching the database. Remove once the design is settled.
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const MOCK_ACTION_ROWS: ActionItemRow[] = [
	{ id: "mock-ack-1", action: "review", href: "#", suiteCode: "UAT-101", suiteName: "Licensing Renewal Portal", roundName: null, timeline: { start: null, end: null }, overdue: false, remaining: 0 },
	{ id: "mock-ack-2", action: "review", href: "#", suiteCode: "UAT-087", suiteName: "Permit Applications", roundName: null, timeline: { start: null, end: null }, overdue: false, remaining: 0 },
	{ id: "mock-returned", action: "review_returned", href: "#", suiteCode: "UAT-059", suiteName: "Billing Statements", roundName: null, timeline: { start: null, end: null }, overdue: false, remaining: 0 },
	{ id: "mock-followup", action: "follow_up", href: "#", suiteCode: "UAT-081", suiteName: "Document Uploads", roundName: "Round 2: Regression", timeline: { start: daysFromNow(-15), end: daysFromNow(-2) }, overdue: false, remaining: 0 },
	{ id: "mock-followup-review", action: "follow_up_review", href: "#", suiteCode: "UAT-045", suiteName: "Audit Trail", roundName: null, timeline: { start: null, end: null }, overdue: false, remaining: 0 },
	{ id: "mock-submit-1", action: "submit", href: "#", suiteCode: "UAT-094", suiteName: "Payments Gateway", roundName: "Round 2: Regression", timeline: { start: daysFromNow(-9), end: daysFromNow(3) }, overdue: false, remaining: 0 },
	{ id: "mock-test-overdue", action: "test", href: "#", suiteCode: "UAT-072", suiteName: "Citizen Registry", roundName: "Round 1: Initial pass", timeline: { start: daysFromNow(-21), end: daysFromNow(-4) }, overdue: true, remaining: 14 },
	{ id: "mock-submit-overdue", action: "submit", href: "#", suiteCode: "UAT-066", suiteName: "Reports Dashboard", roundName: "Round 3: Fixes", timeline: { start: daysFromNow(-12), end: daysFromNow(-1) }, overdue: true, remaining: 0 },
	{ id: "mock-test-1", action: "test", href: "#", suiteCode: "UAT-110", suiteName: "Notifications", roundName: "Round 1: Initial pass", timeline: { start: daysFromNow(-3), end: daysFromNow(11) }, overdue: false, remaining: 27 },
	{ id: "mock-test-2", action: "test", href: "#", suiteCode: null, suiteName: "Profile Settings", roundName: "Round 2: Regression", timeline: { start: daysFromNow(-1), end: null }, overdue: false, remaining: 1 },
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mock?: string }> }) {
	const useMock = process.env.NODE_ENV !== "production" && (await searchParams).mock === "1";
	const user = await requireUser();
	// Same cached call as the sidebar in the layout, so no extra round trip.
	const suites = await getSidebarSuites(user);
	const pipelineTotal = suites.filter((suite) => PIPELINE.some((stage) => inStage(stage, suite.status))).length;
	// Draft first, then Ready: the ones furthest from testing lead.
	const drafts = suites
		.filter((suite) => suite.status === "draft" || suite.status === "ready")
		.sort((a, b) => (a.status === b.status ? 0 : a.status === "draft" ? -1 : 1));
	const [activeRounds, awaitingSignOff, awaitingAck, recentResults] = user.role === "Admin"
		? await Promise.all([getActiveRounds(), getRoundsAwaitingSignOff(), getSignOffsAwaitingAck(), getRecentResults()])
		: [[], [], [], []];

	const activeRoundsRows = activeRounds.map((round) => ({ id: round.iteration.id, suiteName: round.suiteName, suiteCode: round.suiteCode, iteration: round.iteration.name, timeline: { start: round.iteration.startedAt, end: round.iteration.plannedEndDate }, progress: { testCount: round.testedCount, includedCount: round.includedCount }, submissions: round.submittedOrgs }));
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const daysSince = (value: string) => Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);

	// Needs attention: one item per thing the vendor should act on, most urgent kind first.
	const runningSlugs = new Set(activeRounds.map((round) => round.suiteSlug));
	const attention = [
		...activeRounds
			.filter((round) => round.iteration.plannedEndDate != null && round.iteration.plannedEndDate < today)
			.map((round) => ({ key: `overdue-${round.iteration.id}`, Icon: Clock, tone: "text-destructive", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `${round.iteration.name} is past its planned end (${formatDate(round.iteration.plannedEndDate!)})` })),
		...activeRounds
			.filter((round) => round.failedCount > 0)
			.map((round) => ({ key: `failed-${round.iteration.id}`, Icon: CircleAlert, tone: "text-destructive", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `${round.failedCount} Failed/Blocked ${round.failedCount === 1 ? "case" : "cases"} in ${round.iteration.name}` })),
		...activeRounds
			.filter((round) => round.totalOrgs > 0 && round.submittedOrgs === round.totalOrgs)
			.map((round) => ({ key: `complete-${round.iteration.id}`, Icon: CircleCheck, tone: "text-emerald-600", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `Every org submitted ${round.iteration.name}, ready to complete` })),
		...awaitingSignOff
			.filter((round) => !runningSlugs.has(round.suiteSlug))
			.map((round) => ({ key: `signoff-${round.iteration.id}`, Icon: FileSignature, tone: "text-amber-600", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `${round.iteration.name} completed, report not issued yet` })),
		...suites
			.filter((suite) => suite.status === "sign_off_rejected")
			.map((suite) => ({ key: `rejected-${suite.id}`, Icon: CircleAlert, tone: "text-destructive", suite: suite.title, href: `/testsuite/${suite.slug}/sign-off`, text: "Client rejected the report: reopen testing or create a new report" })),
		...awaitingAck.map((signOff) => {
			const days = daysSince(signOff.signedOffAt);
			return { key: `ack-${signOff.id}`, Icon: Hourglass, tone: "text-muted-foreground", suite: signOff.suiteName, href: `/testsuite/${signOff.suiteSlug}/sign-off`, text: `Report${signOff.iterationName ? ` for ${signOff.iterationName}` : ""} awaiting client acknowledgement, ${days === 0 ? "issued today" : `${days} ${days === 1 ? "day" : "days"} waiting`}` };
		}),
	];
	// Sign-off tracker: the attention items that belong to the sign-off flow.
	const signOffTracker = attention.filter((item) => /^(signoff|rejected|ack)-/.test(item.key));

	// The client's in-app notice: issued sign-offs waiting for its answer.
	const canAcknowledge = user.role === "Internal";
	const awaitingMySignOff = canAcknowledge ? suites.filter((suite) => suite.status === "sign_off_issued") : [];

	// Tester view: rounds their org is in, split by whether the org has submitted yet.
	// Planned (not_started) rounds already list their participants, but can't be tested yet.
	const myRunning = suites.filter((suite) => suite.openRound?.status === "in_progress" && suite.mine.inOpenRound);
	const toTest = myRunning.filter((suite) => !suite.mine.submittedAt);
	const submitted = myRunning.filter((suite) => suite.mine.submittedAt);
	const upcoming = suites.filter((suite) => suite.openRound?.status === "not_started" && suite.mine.inOpenRound);
	const roundStarts = user.role === "Admin" || toTest.length === 0 ? new Map<string, string>() : await getRunningRoundStarts();
	const liveTestingRows: ActionItemRow[] = toTest.map(({ id, slug, code, title, openRound, mine }) => ({
		id,
		// Nothing left to test but not handed in yet: the action becomes submitting.
		action: mine.remaining === 0 ? "submit" : "test",
		href: `/testsuite/${slug}/test-cases/all`,
		suiteCode: code,
		suiteName: title,
		roundName: openRound!.name,
		timeline: { start: roundStarts.get(slug) ?? null, end: openRound!.plannedEnd },
		overdue: openRound!.plannedEnd != null && openRound!.plannedEnd < today,
		remaining: mine.remaining,
	}));
	// Issued reports aren't tied to a running round, so they carry no timeline.
	const liveAcknowledgeRows: ActionItemRow[] = awaitingMySignOff.map(({ id, slug, code, title }) => ({
		id: `ack-${id}`,
		action: "review",
		href: `/testsuite/${slug}/sign-off`,
		suiteCode: code,
		suiteName: title,
		roundName: null,
		timeline: { start: null, end: null },
		overdue: false,
		remaining: 0,
	}));
	// A rejected report is back with the vendor; the client only sees it so the outcome isn't lost.
	const liveReturnedRows: ActionItemRow[] = canAcknowledge
		? suites.filter((suite) => suite.status === "sign_off_rejected").map(({ id, slug, code, title }) => ({
			id: `returned-${id}`,
			action: "review_returned",
			href: `/testsuite/${slug}/sign-off`,
			suiteCode: code,
			suiteName: title,
			roundName: null,
			timeline: { start: null, end: null },
			overdue: false,
			remaining: 0,
		}))
		: [];
	const yourTestingRows = useMock ? MOCK_ACTION_ROWS.filter((row) => row.action === "test" || row.action === "submit") : liveTestingRows;
	const acknowledgeRows = useMock ? MOCK_ACTION_ROWS.filter((row) => row.action !== "test" && row.action !== "submit") : [...liveAcknowledgeRows, ...liveReturnedRows];
	// Reports first: they block the vendor's sign-off.
	const actionItemRows = [...acknowledgeRows, ...yourTestingRows];
	const overdueCount = yourTestingRows.filter((row) => row.overdue).length;
	const casesLeft = yourTestingRows.reduce((sum, row) => sum + row.remaining, 0);
	// Notice card: what the tester has to do, most urgent first. Each item jumps to its section.
	const testerActions = [
		...(overdueCount > 0 ? [{ key: "overdue", href: "#continue-testing", Icon: Clock, tone: "text-destructive", urgent: true, text: `${overdueCount} ${overdueCount === 1 ? "round is" : "rounds are"} past the planned end date` }] : []),
		...(awaitingMySignOff.length > 0 ? [{ key: "ack", href: "#acknowledgement", Icon: FileSignature, tone: "text-orange-600", urgent: false, text: `${awaitingMySignOff.length} ${awaitingMySignOff.length === 1 ? "report needs" : "reports need"} your acknowledgement` }] : []),
		...(yourTestingRows.length > 0 ? [{ key: "test", href: "#continue-testing", Icon: ClipboardList, tone: "text-emerald-600", urgent: false, text: `${casesLeft} ${casesLeft === 1 ? "case" : "cases"} left to test across ${yourTestingRows.length} ${yourTestingRows.length === 1 ? "round" : "rounds"}` }] : []),
	];
	// One sentence for the notice: "5 rounds are past the planned end date, 7 sign-offs need your acknowledgement, and 42 cases left to test across 13 rounds."
	const actionSummary = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(testerActions.map((action) => action.text));
	const testerStats = [
		{ label: "Iteration to test", href: "#continue-testing", value: yourTestingRows.length, unit: yourTestingRows.length === 1 ? "round" : "rounds", Icon: ClipboardList, tagline: yourTestingRows.length === 0 ? "Inbox zero, enjoy it" : "Waiting on your submission", tile: "bg-emerald-50 text-emerald-600 border-emerald-600/40" },
		{ label: "Cases left", href: "#continue-testing", value: casesLeft, unit: casesLeft === 1 ? "case" : "cases", Icon: Clock, tagline: casesLeft === 0 ? "Nothing left to break" : "Bugs won't find themselves", tile: "bg-amber-50 text-amber-600 border-amber-600/40" },
		...(canAcknowledge ? [{ label: "Needs acknowledgement", href: "#acknowledgement", value: awaitingMySignOff.length, unit: awaitingMySignOff.length === 1 ? "acknowledgement" : "acknowledgements", Icon: Stamp, tagline: awaitingMySignOff.length === 0 ? "Nothing waiting on you" : "Read it, then answer", tile: "bg-orange-50 text-orange-600 border-orange-600/40" }] : []),
	];

	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="flex flex-col gap-4">
				<div className="px-4 pt-6 sm:px-6">
					<p className="text-xl font-bold sm:text-2xl font-heading">Hello, {user.fullName}</p>
					<p className="text-xs text-muted-foreground">
						{user.role === "Admin"
							? "Your testing command center — see which rounds are moving, who's submitted, and what's ready for acknowledgement."
							: canAcknowledge
								? "Pick up your testing where you left off, and review the reports the development team issued for your answer."
								: "Your turn to put it through its paces. Pick up where you left off and make every click count."}
					</p>
				</div>
				<div className="px-4 pb-6 sm:px-6">
					{user.role === "Admin" && (
						<section className="flex flex-col gap-2">
							<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h2 className="text-xs font-medium">User Acceptance Testing</h2>
								<p className="text-xs text-muted-foreground">
									{pipelineTotal} {pipelineTotal === 1 ? "suite" : "suites"} on the move
								</p>
							</div>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
								{PIPELINE.map((status) => {
									const { Icon, label, className, IconColor } = statusMapping[status];
									const count = suites.filter((suite) => inStage(status, suite.status)).length;
									return (
										<Card
											key={status}
											size="sm"
											className={cn(
												"rounded-md! border border-gray-600/40 bg-gray-50/10! ring-0! md:last:col-span-2 xl:last:col-span-1 transition-[translate,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md",
												count === 0 && "opacity-60",
											)}
										>
											<CardHeader>
												<CardDescription className="text-xs font-medium">{label}</CardDescription>
												<CardTitle className=" font-bold font-mono tabular-nums">
													<div className="flex flex-wrap items-baseline gap-x-2 px-1 text-3xl">
														{count}
														<span className="text-xs text-muted-foreground font-normal">{count === 1 ? "suite" : "suites"}</span>
													</div>
												</CardTitle>
												<CardAction>
													<div className={cn("rounded-lg border p-2 transition-transform duration-200 motion-safe:group-hover/card:-rotate-12 motion-safe:group-hover/card:scale-110", className)}>
														<Icon className={cn("size-4", IconColor)} />
													</div>
												</CardAction>
											</CardHeader>
											<CardContent className="flex flex-col gap-2">
												{/* <Progress
												value={pipelineTotal ? Math.round((count / pipelineTotal) * 100) : 0}
												aria-label={`${label} share of suites`}
												className={cn(IconColor, "[&_[data-slot=progress-indicator]]:bg-current")}
											/> */}
												<p className="text-xs text-muted-foreground">{TAGLINES[status]}</p>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</section>
					)}
					{user.role === "Admin" && (
						<>
							<div className="mt-4 border rounded-md bg-gray-50/10 border-gray-600/40">
								<div className="flex flex-col gap-2 p-4 border-b border-gray-600/40">
									<div className="flex flex-row flex-wrap gap-2 items-center justify-between">
										<div className="flex flex-row gap-2 items-center">
											<div className="bg-emerald-50 text-emerald-600 rounded-md p-2 border border-emerald-600/40">
												<FlaskConical className="size-5" />
											</div>
											<div className="">
												<h2 className="text-xs font-medium">In Testing Test Suites</h2>
												<p className="text-xs text-muted-foreground">Currently running testing iterations by testing suite</p>
											</div>
										</div>
										<Badge variant="secondary">{activeRounds.length} {activeRounds.length === 1 ? "Iteration" : "Iterations"} Running</Badge>
									</div>
								</div>
								{activeRounds.length === 0 ? (
									<div className="flex flex-1 p-10">
										<EmptyState size="sm" title="No rounds running" description="Start a testing round from a suite and it will show up here." icon={FlaskConical} />
									</div>
								) : (
									<ActiveIterationTable activeRounds={activeRoundsRows} />
								)}
							</div>
						</>
					)}
					{user.role === "Admin" && (
						<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
							<div className="border rounded-md bg-gray-50/10 border-gray-600/40 h-fit">
								<div className="flex flex-col gap-2 p-4 border-b border-gray-600/40">
									<div className="flex flex-row gap-2 items-center">
										<div className="bg-blue-50 text-blue-600 rounded-md p-2 border border-blue-600">
											<BookAlert className="size-5" />
										</div>
										<div className="">
											<h2 className="text-xs font-medium">Needs Attention</h2>
											<p className="text-xs text-muted-foreground">{attention.length} {attention.length === 1 ? "item" : "items"} waiting on you</p>
										</div>
									</div>
								</div>
								<ScrollArea className="h-64">
									<div className="flex flex-col p-2 gap-2">
										{attention.length === 0 ? (
											<div className="flex flex-1 p-10">
												<EmptyState size="sm" title="Nothing needs you right now" description="All clear. No rounds are overdue, no acknowledgements are waiting, and no test cases are failing." icon={BookAlert} />
											</div>
										) : attention.map(({ key, Icon, tone, suite, href, text }) => (
											<Link key={key} href={href} className="flex items-center gap-3 text-xs hover:bg-muted/50">
												<div className="px-4 py-2 border rounded-md bg-gray-50/10 border-gray-600/40 flex flex-row gap-3 items-center w-full">
													<Icon className={cn("size-4 shrink-0", tone)} />
													<div className="flex flex-col">
														<span className="font-medium">{suite}</span>
														<span className="text-muted-foreground">{text}</span>
													</div>
													<UrgentPulse tone={tone} />
												</div>
											</Link>
										))}
									</div>
								</ScrollArea>
							</div>
							<div className="border rounded-md bg-gray-50/10 border-gray-600/40 h-fit">
								<div className="flex flex-col gap-2 p-4 border-b border-gray-600/40">
									<div className="flex flex-row gap-2 items-center">
										<div className="bg-gray-50 text-gray-600 rounded-md p-2 border border-gray-600/40">
											<SquarePen className="size-5" />
										</div>
										<div className="">
											<h2 className="text-xs font-medium">Drafts to Finish</h2>
											<p className="text-xs text-muted-foreground">{drafts.length} {drafts.length === 1 ? "suite" : "suites"} not yet in testing</p>
										</div>
									</div>
								</div>
								<ScrollArea className="h-64">
									<div className="flex flex-col gap-2 p-2">
										{drafts.length === 0 ? (
											<div className="flex flex-1 p-10">
												<EmptyState size="sm" title="Nothing to finish" description="All clear. No drafts are waiting to be completed." icon={SquarePen} />
											</div>
										) : drafts.map((suite) => (
											<Link key={suite.id} href={`/testsuite/${suite.slug}/overview`} className="flex items-center gap-3 text-xs hover:bg-muted/50">
												<div className="px-4 py-2 border rounded-md bg-gray-50/10 border-gray-600/40 flex flex-row gap-3 items-center w-full justify-between">
													<div className="flex flex-row gap-4">
														<SquarePen className="size-4 shrink-0 text-muted-foreground" />
														<span className="font-medium">{suite.title}</span>
													</div>
													<span className="text-muted-foreground">{suite.status === "draft" ? "Draft" : "Ready, not started"}</span>
												</div>
											</Link>
										))}
									</div>
								</ScrollArea>
							</div>
							<div className="border rounded-md bg-gray-50/10 border-gray-600/40 h-fit">
								<div className="flex flex-col gap-2 p-4 border-b border-gray-600/40">
									<div className="flex flex-row gap-2 items-center">
										<div className="bg-orange-50 text-orange-600 rounded-md p-2 border border-orange-600/40">
											<Stamp className="size-5" />
										</div>
										<div className="">
											<h2 className="text-xs font-medium">Acknowledgement Tracker</h2>
											<p className="text-xs text-muted-foreground">{signOffTracker.length} {signOffTracker.length === 1 ? "acknowledgement" : "acknowledgements"} in progress</p>
										</div>
									</div>
								</div>
								<ScrollArea className="h-64">
									<div className="flex flex-col justify-between gap-2 p-2">
										{signOffTracker.length === 0 ? (
											<div className="flex flex-1 p-10">
												<EmptyState size="sm" title="Nothing to Track" description="Nothing to track acknowledgements at the moment." icon={Stamp} />
											</div>
										) : signOffTracker.map(({ key, Icon, tone, suite, href, text }) => (
											<Link key={key} href={href} className="flex items-center text-xs hover:bg-muted/50">
												<div className="px-4 py-2 border rounded-md bg-gray-50/10 border-gray-600/40 flex flex-row gap-3 items-center w-full">
													<Icon className={cn("size-4 shrink-0", tone)} />
													<div className="flex flex-col">
														<span className="font-medium">{suite}</span>
														<span className="text-muted-foreground">{text}</span>
													</div>
													<UrgentPulse tone={tone} />
												</div>
											</Link>
										))}
									</div>
								</ScrollArea>
							</div>
						</div>
					)}
					{user.role === "Admin" && (
						<div className="mt-4 border rounded-md bg-gray-50/10 border-gray-600/40">
							<div className="flex flex-col gap-2 p-4 border-b border-gray-600/40">
								<div className="flex flex-row gap-2 items-center">
									<div className="bg-violet-50 text-violet-600 rounded-md p-2 border border-violet-600/40">
										<History className="size-5" />
									</div>
									<div className="">
										<h2 className="text-xs font-medium">Recent Activity</h2>
										<p className="text-xs text-muted-foreground">Latest test results across all rounds</p>
									</div>
								</div>
							</div>
							{recentResults.length === 0 ? (
								<div className="flex flex-1 p-10">
									<EmptyState size="sm" title="No activity yet" description="Results will show up here as testers record them." icon={History} />
								</div>
							) : (
								<ul className="flex flex-col divide-y">
									{recentResults.map((result) => (
										<li key={result.id}>
											<Link href={testResultsHref(result.suiteSlug)} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2 text-xs hover:bg-muted/50">
												<span className="font-medium">{result.organizationName ?? result.executorName ?? "Someone"}</span>
												<span className={cn("font-medium", RESULT_TONE[result.status] ?? "text-muted-foreground")}>
													{result.status.toLowerCase()}
												</span>
												<span>
													{result.code && <span className="mr-1 font-mono text-muted-foreground">{result.code}</span>}
													{result.title}
												</span>
												<span className="text-muted-foreground">
													· {result.suiteName}, {result.iterationName}
													{result.executorName && result.organizationName ? ` · by ${result.executorName}` : ""}
												</span>
												<span className="ml-auto text-muted-foreground">{formatDate(result.completedAt)}</span>
											</Link>
										</li>
									))}
								</ul>
							)}
						</div>
					)}
					{user.role !== "Admin" && (
						<div className="flex flex-col gap-4">
							{testerActions.length > 0 && (
								<DismissibleNotice tone={testerActions[0].urgent ? "destructive" : "amber"}>
									<div className="flex flex-row items-center gap-2">
										<BellRing className="size-5 shrink-0" />
										<div>
											<p className="font-heading text-sm font-semibold">You have pending actions to take</p>
											<p className="text-xs opacity-80 first-letter:uppercase">{actionSummary}.</p>
										</div>
									</div>
								</DismissibleNotice>
							)}
							<DashboardCard Icon={CalendarRange} tone="blue" title="Testing Timeline" description="Key dates for the rounds your org is part of, from kickoff to the planned end of testing">
								<TestingSchedule />
							</DashboardCard>

							<div className={"grid grid-cols-1 gap-3 md:grid-cols-3"}>
								{testerStats.map(({ label, href, value, unit, Icon, tagline, tile }) => (
									<Link key={label} href={href} className="group/card block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2">
										<Card
											size="sm"
											className={cn(
												"rounded-md! border border-gray-600/40 bg-gray-50/10! ring-0! transition-[translate,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md",
												value === 0 && "opacity-60",
											)}
										>
											<CardHeader>
												<CardDescription className="text-xs font-medium">{label}</CardDescription>
												<CardTitle className="font-bold font-mono tabular-nums">
													<div className="flex flex-wrap items-baseline gap-x-2 px-1 text-3xl">
														{value}
														<span className="text-xs font-normal text-muted-foreground">{unit}</span>
													</div>
												</CardTitle>
												<CardAction>
													<div className={cn("rounded-lg border p-2 transition-transform duration-200 motion-safe:group-hover/card:-rotate-12 motion-safe:group-hover/card:scale-110", tile)}>
														<Icon className="size-4" />
													</div>
												</CardAction>
											</CardHeader>
											<CardContent>
												<p className="text-xs text-muted-foreground">{tagline}</p>
											</CardContent>
										</Card>
									</Link>
								))}
							</div>

							<DashboardPanel
								id="continue-testing"
								Icon={FlaskConical}
								tone="emerald"
								title="Your Action Items"
								description="Everything waiting on you: record results, submit your round, or acknowledge a report"
								action={overdueCount > 0 ? <Badge variant="destructive">{overdueCount} overdue</Badge> : undefined}
								empty={actionItemRows.length === 0 ? { title: "No action items", description: "You're all caught up. Rounds that need your results will show up here once your org is invited." } : undefined}
								scroll={false}
							>
								<ActionItemsTable rows={actionItemRows} />
							</DashboardPanel>
						</div>
					)}
				</div>
			</div>
		</ScrollArea>
	);
}
