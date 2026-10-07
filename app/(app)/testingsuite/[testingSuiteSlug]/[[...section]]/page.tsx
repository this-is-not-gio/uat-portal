import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
	LayoutDashboard,
	ListChecks,
	Activity,
	Paperclip,
	LucideIcon,
	CircleCheckBig,
	CircleDashed,
	Stamp,
	Circle,
	CircleCheck,
	FolderClock,
	ClipboardEdit,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getSuiteReadinessIssues, getSuiteScope, getTestSuite, type readinessIssue, type suiteScope } from "@/lib/supabase/test-suite";
import { ScopeOfTesting } from "@/components/testsuite-layout/overview/scope-of-testing";
import PageTab from "../page-tab";
import { getCurrentUser } from "@/lib/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SuiteStatusButton from "../components/suite-status-button";
import SuiteHeaderMenu from "../components/suite-header-menu";
import StartIterationDialog from "../components/start-iteration-dialog";
import SignOffDialog, { AcknowledgeSignOffDialog } from "../components/sign-off-dialog";
import { getPendingSignOff, getSignOffContext, getSuiteOverview, getSuiteSignOffs } from "@/lib/supabase/overview";
import { getSuiteEndpoints, getSuiteOverviewSections, getSuiteTestAccounts } from "@/lib/supabase/test-accounts";
import type { ExitCriteria } from "@/lib/supabase/sign-off-report";
import OverviewTab from "../../../../../components/testsuite-layout/overview/overview-tab";
import OverviewTabSkeleton from "@/components/testsuite-layout/overview/overview-tab-skeleton";
import SignOffTab from "../sign-off-tab";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import SubmitResultsDialog from "../components/submit-results-dialog";
import { can } from "@/lib/auth/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statusMapping, type testingsuiteLifeCycle } from "@/components/testsuite-layout/suite-status-badge";
import { testCasesHref } from "@/components/testsuite-layout/test-cases/href";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";





// Draft header checklist for Mark as Ready, one row per suite_readiness_issues code (the DB
// runs the same rule on the move). "Test cases added" is split out of the complete-case row
// so an empty suite reads as "add cases" rather than "finish a case".
function readinessChecklist(scope: suiteScope, issues: readinessIssue[]) {
	const has = (issue: readinessIssue["issue"]) => issues.some((i) => i.issue === issue);
	return [
		{
			title: "Test cases added",
			description: scope.testCaseCount > 0
				? `${scope.testCaseCount} test case${scope.testCaseCount === 1 ? "" : "s"} in this suite`
				: "Add or import test cases",
			met: scope.testCaseCount > 0,
		},
		{
			title: "One complete test case",
			description: "Steps, expected results and a role assignee",
			met: !has("no_complete_test_cases"),
		},
		{
			title: "Test account added",
			description: "At least one login on the Overview",
			met: !has("no_test_accounts"),
		},
		{
			title: "Endpoint added",
			description: "At least one URL on the Overview",
			met: !has("no_endpoints"),
		},
	];
}




const currentTestingSuiteStatus = {
	status: "ready" as testingsuiteLifeCycle,
}

export default async function TestsuitePage({
	params,
	searchParams,
}: {
	params: Promise<{ testingSuiteSlug: string; section?: string[] }>;
	searchParams: Promise<{ tab?: string; iteration?: string; org?: string; signOff?: string }>;
}) {
	const { testingSuiteSlug, section } = await params;
	const { tab, iteration, org, signOff } = await searchParams;
	// Other tabs only ever see a plain section slug (Test Cases redirects below with the raw path).
	const sectionSlug = section?.[0];
	const testSuite = await getTestSuite({ slug: testingSuiteSlug });
	if (!testSuite) notFound();
	const currentUser = await getCurrentUser();
	// Testers (Internal/External) never see a suite before it's handed over for testing.
	const isTester = currentUser?.role === "Internal" || currentUser?.role === "External";
	if (isTester && (testSuite.status === "draft" || testSuite.status === "ready")) notFound();
	// Test Cases and Test Results moved under /testsuite/{slug}; old links go there with the
	// same section and lens (the results route itself sends testers to Test Cases).
	if (tab === "test-results") redirect(testResultsHref(testingSuiteSlug, sectionSlug ?? "all", { iteration, org }));
	if (tab === "test-cases") {
		const query = new URLSearchParams({ ...(iteration ? { iteration } : {}), ...(org ? { org } : {}) }).toString();
		redirect(`${testCasesHref(testingSuiteSlug, ...(section?.length ? section : ["all"]))}${query ? `?${query}` : ""}`);
	}
	// Only needed for the Sign Off button.
	const signOffContext = testSuite.status === "in_testing" ? await getSignOffContext(testSuite.id, currentUser?.organization?.id) : null;
	// Vendor has issued the sign-off; the client acknowledges it to close the suite.
	const pendingSignOff = testSuite.status === "sign_off_issued" ? await getPendingSignOff(testSuite.id) : null;
	// Draft checklist: what still blocks Mark as Ready (the DB runs the same check on the move).
	// Scope of Testing shows in the header for every status.
	const [draftIssues, scope, allSignOffs] = await Promise.all([
		testSuite.status === "draft" ? getSuiteReadinessIssues(testSuite.id) : Promise.resolve([]),
		getSuiteScope(testSuite.id),
		can(currentUser, "view_all_results") && testSuite.status !== "draft" && testSuite.status !== "ready"
			? getSuiteSignOffs(testSuite.id) : Promise.resolve([]),
	]);
	// Sign-off tab: staff only, once a sign-off with a frozen report exists (withdrawn ones included).
	const reportSignOffs = allSignOffs.filter((s) => s.hasReport);
	const showSignOffTab = reportSignOffs.length > 0;
	if (tab === "sign-off" && !showSignOffTab) redirect(`/testingsuite/${testingSuiteSlug}?tab=overview`);
	const selectedSignOffId = reportSignOffs.find((s) => s.id === signOff)?.id
		?? reportSignOffs.find((s) => !s.revokedAt)?.id
		?? reportSignOffs[0]?.id;
	const canMarkReady = draftIssues.length === 0;
	// Submit Result: the viewer's org in the open round, until it submits (the Test Cases notice takes over from there).
	const currentRound = signOffContext?.currentIteration ?? null;
	// Header state of the open round: still being planned, running and waiting on submissions, or every testing org submitted.
	const roundState = !currentRound || currentRound.isFallback ? null
		: currentRound.iteration.status === "not_started" ? { label: "Planning", dot: "bg-gray-400" }
			: currentRound.pendingSubmissions > 0 ? { label: `${currentRound.pendingSubmissions} submission${currentRound.pendingSubmissions === 1 ? "" : "s"} pending`, dot: "bg-amber-500" }
				: { label: "All submissions in", dot: "bg-green-600" };
	// Ready suite: a round can be planned (not_started) before UAT 01 begins; begin moves the suite to In Testing.
	const plannedRound = testSuite.status === "ready"
		? testSuite.iterations
			.filter((i) => i.status === "not_started")
			.sort((a, b) => b.iterationNumber - a.iterationNumber)[0] ?? null
		: null;
	// Issue Sign-off criteria still unmet (the first two mirror SignOffDialog's blocker and the DB check).
	const signOffBlockers = !signOffContext ? [] : [
		signOffContext.hasActiveIteration && "Finish the open iteration (complete, stop or cancel it).",
		!signOffContext.latestCompleted && "Complete at least one iteration.",
		signOffContext.openUntestedCases > 0 && `${signOffContext.openUntestedCases} test case${signOffContext.openUntestedCases === 1 ? " still needs" : "s still need"} a finished result.`,
	].filter((blocker): blocker is string => !!blocker);
	const ownParticipation = currentRound?.ownParticipation ?? null;
	const showSubmit = can(currentUser, "submit") && !!ownParticipation && !currentRound?.isFallback && !ownParticipation.submittedAt;
	const Icon = statusMapping[testSuite.status].Icon;
	const NextIcon = statusMapping[testSuite.status].nextStatusIcon

	const overviewTabSlot =
		!tab || tab === "overview" ?
			<Suspense fallback={<OverviewTabSkeleton />}>
				{/* Same lock as upsert_suite (assert_suite_editable). */}
				<OverviewContent suite={testSuite} scope={scope} exitCriteria={testSuite.exitCriteria} canEdit={can(currentUser, "author") && !["sign_off_issued", "signed_off", "archived"].includes(testSuite.status)} canEditCriteria={can(currentUser, "author") && (testSuite.status === "draft" || testSuite.status === "ready")} />
			</Suspense>
			: null

	const signOffTabSlot =
		tab === "sign-off" && selectedSignOffId ?
			<Suspense fallback={<OverviewTabSkeleton />}>
				<SignOffTab suiteSlug={testingSuiteSlug} signOffs={reportSignOffs} selectedId={selectedSignOffId} />
			</Suspense>
			: null

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="px-6 flex flex-row items-center justify-between">
				<div className="">
					<div className="flex flex-row items-center gap-2">
						<h1 className="font-heading font-semibold">{testSuite.name}</h1>
						<div className={`flex flex-row items-center gap-1 rounded-md py-1.5 px-2 ${statusMapping[testSuite.status].className}`}>
							<Icon size={12} />
							<p className="text-xs font-semibold">{statusMapping[testSuite.status].label}</p>
						</div>

						{/* <Badge variant="outline" className={`text-xs border font-heading rounded-md ${statusMapping[testSuite.status].className}`}>
							<Icon className="h-3 w-3" />
							{statusMapping[testSuite.status].label}
						</Badge> */}

					</div>
					<p className="text-xs text-muted-foreground">Testing Suite</p>
				</div>
				<div className="flex flex-row items-center gap-5">
					{
						testSuite.status === "draft" ? (
							<div className="flex flex-row items-end gap-">
								<div className="flex flex-row items-center gap-4">
									{readinessChecklist(scope, draftIssues).map((item) => (
										<div key={item.title} className="flex flex-row items-center gap-2">
											{item.met
												? <CircleCheck className="size-5 text-green-800" />
												: <Circle className="size-5 text-muted-foreground" />}
											<div className="">
												<p className="font-semibold text-xs">{item.title}</p>
												<p className="text-xs text-muted-foreground">{item.description}</p>
											</div>
										</div>
									))}
								</div>
								{/* Hidden until every checklist item is met (the DB rejects the move otherwise). */}
								{canMarkReady && (
									<SuiteStatusButton suiteId={testSuite.id} targetStatus="ready">
										{NextIcon && <NextIcon className="h-4 w-4" />}
										<p className="text-xs">Mark as Ready</p>
									</SuiteStatusButton>
								)}
							</div>
						) : testSuite.status === "ready" ? (
							<div className="flex flex-row items-start gap-5 ">
								{/* A planned round shows as Planning; with none yet, the empty state. */}
								<div className="flex flex-col items-end">
									<div className="flex flex-col items-end gap-1">
										<p className="text-xs text-muted-foreground">Testing Iteration</p>
										<div className="flex flex-row items-center gap-2">
											{/* Planning chip: same shape as the suite status badge; the pulse says the round is being set up, not running. */}
											{plannedRound && (
												<div className="flex flex-row items-center gap-1.5 py-1.5 px-3 rounded-md bg-yellow-500/10 text-amber-700">
													<span className="relative flex size-2">
														<span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-60 motion-safe:animate-ping" />
														<span className="relative inline-flex size-2 rounded-full bg-amber-600" />
													</span>
													<p className="text-xs font-semibold">Planning</p>
												</div>
											)}
											{plannedRound ? (
												<p className="font-semibold py-1.5 text-xs">{plannedRound.name}</p>
											) : (
												<p className="font-semibold text-muted-foreground text-xs py-1.5">No iteration yet</p>
											)}
										</div>
									</div>
								</div>
								{/* A planned round: go set it up (participants, sections) on its page. None yet: plan one. */}
								<div className="self-end" >
									{plannedRound ? (
										<Button nativeButton={false} render={<Link href={`/testingsuite/${testingSuiteSlug}/${plannedRound.slug}?tab=test-cases`} />} className="flex flex-row items-center gap-2 ">
											<ClipboardEdit className="h-4 w-4" />
											<p className="text-xs">Start Testing</p>
										</Button>
									) : (
										<StartIterationDialog
											suiteId={testSuite.id}
											trigger={
												<Button className="flex flex-row items-center gap-2 ">
													<ClipboardEdit className="h-4 w-4" />
													<p className="text-xs">Start Testing</p>
												</Button>
											}
										/>
									)}
								</div>
							</div>
						) : testSuite.status === "in_testing" && signOffContext ? (
							<div className="flex flex-row items-center gap-5">
								{/* Open round, else the newest one (isFallback). Counts the viewer's own org's cases (Admin: each case once). */}
								{signOffContext.currentIteration && (
									<div className="flex flex-col items-end gap-1">
										<p className="text-xs text-muted-foreground">Testing Iteration</p>
										<Tooltip>
											<TooltipTrigger render={
												<div className="flex flex-row items-center gap-1.5 py-1.5 px-3 rounded-md bg-blue-500/10 text-blue-700">
													<span className="relative flex size-2">
														<span className="absolute inline-flex size-full rounded-full bg-blue-400 opacity-60 motion-safe:animate-ping" />
														<span className="relative inline-flex size-2 rounded-full bg-blue-600" />
													</span>
													<p className="text-xs font-semibold">{signOffContext.currentIteration.iteration.name}</p>
												</div>
											} />
											<TooltipContent side="bottom" className="">
												<p className="text-xs">Iteration {signOffContext.currentIteration.iteration.iterationNumber} is open for testing</p>
												{/* Awaiting submissions / all in / planning; none when this is the last finished round (isFallback). */}
												{roundState && <p className="text-xs opacity-70">{roundState.label}</p>}
											</TooltipContent>
										</Tooltip>
									</div>
								)}
								{/* Step 1: the vendor issues the sign-off once every test case the rounds need has a finished result. An open round still blocks it inside the dialog. */}
								{/* Unmet criteria disable the button; the tooltip lists what's left. */}
								{can(currentUser, "issue_sign_off") ? (
									<div className="self-end">
										{signOffBlockers.length > 0 ? (
											<Tooltip>
												{/* A disabled button gets no pointer events, so the span carries the hover. */}
												<TooltipTrigger render={<span className="inline-flex cursor-not-allowed" tabIndex={0} />}>
													<Button className="flex flex-row items-center gap-2 pointer-events-none" disabled>
														{NextIcon && <NextIcon className="h-4 w-4" />}
														<p className="text-xs">Issue Sign-off</p>
													</Button>
												</TooltipTrigger>
												<TooltipContent className="flex flex-col items-start gap-1">
													<p className="text-xs font-semibold">Meet the sign-off criteria first:</p>
													<ul className="list-disc pl-4">
														{signOffBlockers.map((blocker) => <li key={blocker} className="text-xs">{blocker}</li>)}
													</ul>
												</TooltipContent>
											</Tooltip>
										) : (
											<SignOffDialog
												suiteId={testSuite.id}
												hasActiveIteration={signOffContext.hasActiveIteration}
												latestCompleted={signOffContext.latestCompleted}
												openUntestedCases={signOffContext.openUntestedCases}
												aiDraftAvailable={!!process.env.GROQ_API_KEY}
												trigger={
													<Button className="flex flex-row items-center gap-2">
														{NextIcon && <NextIcon className="h-4 w-4" />}
														<p className="text-xs">Issue Sign-off</p>
													</Button>
												}
											/>
										)}
									</div>
								) : null}
							</div>
						) : testSuite.status === "sign_off_issued" ? (
							// Step 2: the client acknowledges, which closes the suite (signed_off).
							<div className="flex flex-row items-center gap-5">
								<div className="flex flex-col items-end">
									<p className="font-semibold text-sm">
										{pendingSignOff ? `Issued by ${pendingSignOff.signedOffBy ?? "the vendor"}` : "Sign-off issued"}
									</p>
									<p className="text-xs text-muted-foreground">
										{pendingSignOff ? `Based on ${pendingSignOff.iterationName} · ` : ""}Waiting for the client to acknowledge
									</p>
								</div>
								{can(currentUser, "sign_off") && pendingSignOff && (
									<AcknowledgeSignOffDialog
										suiteId={testSuite.id}
										signOff={pendingSignOff}
										reportHref={pendingSignOff.hasReport ? `/testingsuite/${testingSuiteSlug}/sign-off/${pendingSignOff.id}/report` : null}
										trigger={
											<Button className="flex flex-row items-center gap-2">
												{NextIcon && <NextIcon className="h-4 w-4" />}
												<p className="text-xs">Acknowledge Sign-off</p>
											</Button>
										}
									/>
								)}
							</div>
						) : testSuite.status === "signed_off" ? (
							<div className="flex flex-row items-end gap-5">
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="archived">
									{NextIcon && <NextIcon className="h-4 w-4" />}
									<p className="text-xs">Archive</p>
								</SuiteStatusButton>
							</div>
						) : testSuite.status === "archived" ? (
							<div className="flex flex-row items-end gap-5">
								<ScopeOfTesting scope={scope} />
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="signed_off" variant="outline">
									<p className="text-xs">Unarchive</p>
								</SuiteStatusButton>
							</div>
						) : null
					}
					{can(currentUser, "author") && <SuiteHeaderMenu suite={testSuite} exitCriteria={testSuite.exitCriteria} />}
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col">
				<PageTab overviewTab={overviewTabSlot} showTestResults={!isTester && testSuite.status !== "draft" && testSuite.status !== "ready"} signOffTab={signOffTabSlot} showSignOffTab={showSignOffTab} />
			</div>
		</div>
	)
}

async function OverviewContent({ suite, scope, exitCriteria, canEdit, canEditCriteria }: { suite: { id: string; slug: string; name: string; description: string; status: testingsuiteLifeCycle }; scope: suiteScope; exitCriteria: ExitCriteria; canEdit: boolean; canEditCriteria: boolean }) {
	const [overview, testAccounts, overviewSections, endpoints] = await Promise.all([getSuiteOverview(suite.id), getSuiteTestAccounts(suite.id), getSuiteOverviewSections(suite.id), getSuiteEndpoints(suite.id)]);
	return <OverviewTab suite={suite} scope={scope} overview={overview} testAccounts={testAccounts} overviewSections={overviewSections} endpoints={endpoints} canEdit={canEdit} exitCriteria={exitCriteria} canEditCriteria={canEditCriteria} />;
}
