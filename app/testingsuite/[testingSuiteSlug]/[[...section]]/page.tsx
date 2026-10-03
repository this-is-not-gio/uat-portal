import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
	ClipboardList,
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
} from "lucide-react";
import { EpicWorkspace } from "@/components/epic-workspace";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getSuiteReadinessIssues, getTestSuite } from "@/lib/supabase/test-suite";
import { getSectionNames } from "@/lib/supabase/test-sections";
import PageTab from "../page-tab";
import TestCasesTab from "../test-cases-tab";
import TestResultTab from "../test-result-tab";
import TesterTestCasesTab from "../tester-test-cases-tab";
import { getCurrentUser } from "@/lib/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SuiteStatusButton, { READINESS_ISSUES } from "../components/suite-status-button";
import SuiteDialog from "@/components/suite-dialog";
import { Pencil } from "lucide-react";
import StartIterationDialog from "../components/start-iteration-dialog";
import SignOffDialog, { AcknowledgeSignOffDialog } from "../components/sign-off-dialog";
import { getPendingSignOff, getSignOffContext, getSuiteOverview } from "@/lib/supabase/overview";
import OverviewTab from "../overview-tab";
import OverviewTabSkeleton from "../overview-tab-skeleton";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import SubmitResultsDialog from "../components/submit-results-dialog";
import { can } from "@/lib/auth/permissions";
import ImportUATTestCases from "../components/import-uat-test-cases";



type testingsuiteLifeCycle = "draft" | "ready" | "in_testing" | "sign_off_issued" | "signed_off" | "archived";

const statusMapping: Record<testingsuiteLifeCycle, { Icon: LucideIcon, label: string, className: string, nextStatusIcon: LucideIcon | null }> = {
	draft: { Icon: ClipboardList, label: "Drafting", className: "bg-gray-500/10 border-gray-800/50 text-gray-800", nextStatusIcon: CircleCheckBig },
	ready: { Icon: CircleCheckBig, label: "For Testing", className: "bg-green-500/10 border-green-800/50 text-green-800", nextStatusIcon: ListChecks },
	in_testing: { Icon: ListChecks, label: "In Testing", className: "bg-blue-500/10 border-blue-800/50 text-blue-800", nextStatusIcon: Stamp },
	sign_off_issued: { Icon: Stamp, label: "Sign-off Issued", className: "bg-amber-500/10 border-amber-800/50 text-amber-800", nextStatusIcon: Activity },
	signed_off: { Icon: Activity, label: "Signed Off", className: "bg-purple-500/20 border-purple-800/50 text-purple-800", nextStatusIcon: Paperclip },
	archived: { Icon: Paperclip, label: "Archived", className: "bg-red-500/20 border-red-800/50 text-red-800", nextStatusIcon: ClipboardList },

};

// Friendly titles/descriptions for the same rule suite-status-button.tsx
// enforces (READINESS_ISSUES) — every draft suite needs these before it can
// go Ready.
const READINESS_REQUIREMENTS: { key: keyof typeof READINESS_ISSUES; title: string; description: string }[] = [
	{ key: "no_complete_test_cases", title: "At least one complete test case", description: "Complete = has steps, every step has an expected result, and a role assignee is set. Only complete test cases can be picked when starting an iteration." },
];



const currentTestingSuiteStatus = {
	status: "ready" as testingsuiteLifeCycle,
}

export default async function TestsuitePage({
	params,
	searchParams,
}: {
	params: Promise<{ testingSuiteSlug: string; section?: string[] }>;
	searchParams: Promise<{ tab?: string; iteration?: string; org?: string }>;
}) {
	const { testingSuiteSlug, section } = await params;
	const { tab, iteration, org } = await searchParams;
	// Test Cases gets the raw path (it also handles the nested
	// testing-itration/{iterationNumber}/{section} shape); other tabs only
	// ever see a plain section slug.
	const sectionSlug = section?.[0];
	const testSuite = await getTestSuite({ slug: testingSuiteSlug });
	if (!testSuite) notFound();
	const currentUser = await getCurrentUser();
	// Testers (Internal/External) never see a suite before it's handed over for testing.
	const isTester = currentUser?.role === "Internal" || currentUser?.role === "External";
	if (isTester && (testSuite.status === "draft" || testSuite.status === "ready")) notFound();
	// Only staff can import, so testers skip the lookup (used to mark new sections in a staged import).
	const existingSectionNames = isTester ? [] : await getSectionNames(testSuite.id);
	// Testers have no Test Results tab; their round results are in Test Cases, so send old links there.
	if (isTester && tab === "test-results") {
		const query = new URLSearchParams({ tab: "test-cases", ...(iteration ? { iteration } : {}), ...(org ? { org } : {}) });
		redirect(`/testingsuite/${testingSuiteSlug}/all?${query}`);
	}
	// Only needed for the Sign Off button.
	const signOffContext = testSuite.status === "in_testing" ? await getSignOffContext(testSuite.id, currentUser?.organization?.id) : null;
	// Vendor has issued the sign-off; the client acknowledges it to close the suite.
	const pendingSignOff = testSuite.status === "sign_off_issued" ? await getPendingSignOff(testSuite.id) : null;
	// Draft checklist: what still blocks Mark as Ready (the DB runs the same check on the move).
	const draftIssues = testSuite.status === "draft" ? await getSuiteReadinessIssues(testSuite.id) : [];
	const canMarkReady = draftIssues.length === 0;
	// Submit Result: the viewer's org in the open round, until it submits (the Test Cases notice takes over from there).
	const currentRound = signOffContext?.currentIteration ?? null;
	// Header state of the open round: still being planned, running and waiting on submissions, or every testing org submitted.
	const roundState = !currentRound || currentRound.isFallback ? null
		: currentRound.iteration.status === "not_started" ? { label: "Planning", dot: "bg-gray-400" }
			: currentRound.pendingSubmissions > 0 ? { label: `${currentRound.pendingSubmissions} submission${currentRound.pendingSubmissions === 1 ? "" : "s"} pending`, dot: "bg-amber-500" }
				: { label: "All submissions in", dot: "bg-green-600" };
	const ownParticipation = currentRound?.ownParticipation ?? null;
	const showSubmit = can(currentUser, "submit") && !!ownParticipation && !currentRound?.isFallback && !ownParticipation.submittedAt;
	const Icon = statusMapping[testSuite.status].Icon;
	const NextIcon = statusMapping[testSuite.status].nextStatusIcon

	const overviewTabSlot =
		!tab || tab === "overview" ?
			<Suspense fallback={<OverviewTabSkeleton />}>
				<OverviewContent suite={testSuite} />
			</Suspense>
			: null

	const testCasesTabSlot =
		tab === "test-cases" && isTester && currentUser ?
			<TesterTestCasesTab testSuiteId={testSuite.id} testSuiteSlug={testingSuiteSlug} suiteName={testSuite.name} suiteStatus={testSuite.status} sectionSlug={sectionSlug} iterationNumber={iteration} orgId={org} currentUser={currentUser} />
			: tab === "test-cases" ?
				<TestCasesTab testSuiteId={testSuite.id} testSuiteSlug={testingSuiteSlug} suiteName={testSuite.name} suiteStatus={testSuite.status} sectionPath={section} />
				: null

	const testResultsTabSlot =
		tab === "test-results" && !isTester ?
			<TestResultTab testSuiteId={testSuite.id} testSuiteSlug={testingSuiteSlug} suiteName={testSuite.name} suiteStatus={testSuite.status} sectionSlug={sectionSlug} iterationNumber={iteration} orgId={org} />
			: null

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="px-6 flex flex-row items-center justify-between">
				<div className="">
					<div className="flex flex-row items-center gap-2">
						<h1 className="font-heading font-semibold">{testSuite.name}</h1>
						<Badge variant="outline" className={`text-xs border font-heading rounded-md ${statusMapping[testSuite.status].className}`}>
							<Icon className="h-3 w-3" />
							{statusMapping[testSuite.status].label}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground">Testing Suite</p>
				</div>
				<div className="">
					{
						testSuite.status === "draft" ? (
							// <div className=" ">
							// 	{/* Mark as Ready is rendered after the checklist hover card below. */}
							// 	<div className="flex flex-row items-end gap-2">


							// 		<HoverCard>
							// 			<HoverCardTrigger render={
							// 				<div className="flex flex-row items-center gap-2">
							// 					<div className="flex flex-col items-end">
							// 						<p className="font-semibold text-sm">{canMarkReady ? "Ready to hand over" : "Test suite is not Ready"}</p>
							// 						<p className="text-xs text-muted-foreground">
							// 							{canMarkReady ? "At least one test case is complete" : "This suite is still a draft and cannot be mark as ready"}
							// 						</p>
							// 					</div>
							// 					<div className="flex flex-row items-center justify-center size-10 bg-gray-500/10 border border-gray-800/50 rounded-md">
							// 						<CircleDashed className="size-4 text-gray-500" />
							// 					</div>
							// 				</div>
							// 			} />
							// 			<HoverCardContent className="w-80 mt-2 px-4 py-3" side="bottom">
							// 				<div className="flex flex-col gap-2">
							// 					<div className="flex flex-col">
							// 						<p className="font-semibold text-sm">Test Suite is not ready</p>
							// 						<p className="text-xs text-muted-foreground">
							// 							This suite is still a Draft — testers can&apos;t see it yet. Here&apos;s what&apos;s left before you can mark it Ready:
							// 						</p>
							// 					</div>
							// 					<div className="flex flex-col gap-1">
							// 						{READINESS_REQUIREMENTS.map((requirement) => (
							// 							<div key={requirement.key} className="flex flex-row items-start gap-2 p-2">
							// 								{draftIssues.some((issue) => issue.issue === requirement.key)
							// 									? <Circle className="size-4 shrink-0 text-gray-500 mt-0.5" />
							// 									: <CircleCheck className="size-4 shrink-0 text-green-700 mt-0.5" />}
							// 								<div className="">
							// 									<p className="font-medium text-sm">{requirement.title}</p>
							// 									<p className="text-xs text-muted-foreground">{requirement.description}</p>
							// 								</div>
							// 							</div>
							// 						))}
							// 					</div>
							// 					<div className="flex items-center gap-2">
							// 						<p className="text-xs text-muted-foreground">
							// 							Once every test case clears these, hit Mark as Ready to unlock the suite for testing.
							// 						</p>
							// 					</div>
							// 				</div>
							// 			</HoverCardContent>
							// 		</HoverCard>
							// 		{canMarkReady && (
							// 			<SuiteStatusButton suiteId={testSuite.id} targetStatus="ready">
							// 				{NextIcon && <NextIcon className="h-4 w-4" />}
							// 				<p className="text-xs">Mark as Ready</p>
							// 			</SuiteStatusButton>
							// 		)}
							// 	</div>
							// </div>
							// <ImportUATTestCases/>
							<></>
						) : testSuite.status === "ready" ? (
							<div className="flex flex-row items-center gap-2">
								{/* <SuiteStatusButton suiteId={testSuite.id} targetStatus="draft" variant="outline">
									<p className="text-xs">Back to Draft</p>
								</SuiteStatusButton>
								<StartIterationDialog
									suiteId={testSuite.id}
									trigger={
										<Button className="flex flex-row items-center gap-2">
											{NextIcon && <NextIcon className="h-4 w-4" />}
											<p className="text-xs">Start Testing</p>
										</Button>
									}
								/> */}
							</div>
						) : testSuite.status === "in_testing" && signOffContext ? (
							<div className="flex flex-row items-center gap-4">
								{/* Open round, else the newest one (isFallback). Counts the viewer's own org's cases (Admin: each case once). */}
								{signOffContext.currentIteration && (
									<div className="flex flex-col items-end gap-1">
										<div className="flex flex-col items-end">
											<p className="text-xs text-muted-foreground">
												{signOffContext.currentIteration.isFallback ? "Last Iteration" : "Current Iteration"}
											</p>
											<p className="font-semibold text-sm">{signOffContext.currentIteration.iteration.name}</p>
										</div>
										{/* Planning / waiting on submissions / all submitted (roundState). */}
										{roundState && (
											<div className="flex flex-row items-center gap-1.5 text-xs">
												<span className={`size-1 rounded-full ${roundState.dot}`} />
												<p className="text-xs text-muted-foreground font-mono">{roundState.label}</p>
											</div>
										)}
									</div>
								)}
								{/* Step 1: the vendor issues the sign-off once every test case the rounds need has a finished result. An open round still blocks it inside the dialog. */}
								{can(currentUser, "issue_sign_off") && signOffContext.openUntestedCases === 0 ? (
									<SignOffDialog
										suiteId={testSuite.id}
										hasActiveIteration={signOffContext.hasActiveIteration}
										latestCompleted={signOffContext.latestCompleted}
										openUntestedCases={signOffContext.openUntestedCases}
										trigger={
											<Button className="flex flex-row items-center gap-2">
												{NextIcon && <NextIcon className="h-4 w-4" />}
												<p className="text-xs">Issue Sign-off</p>
											</Button>
										}
									/>
								) : null}
							</div>
						) : testSuite.status === "sign_off_issued" ? (
							// Step 2: the client acknowledges, which closes the suite (signed_off).
							<div className="flex flex-row items-center gap-4">
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
							<div className="">
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="archived">
									{NextIcon && <NextIcon className="h-4 w-4" />}
									<p className="text-xs">Archive</p>
								</SuiteStatusButton>
							</div>
						) : testSuite.status === "archived" ? (
							<div className="">
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="signed_off" variant="outline">
									<p className="text-xs">Unarchive</p>
								</SuiteStatusButton>
							</div>
						) : null
					}
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col">
				<PageTab overviewTab={overviewTabSlot} testCasesTab={testCasesTabSlot} testResultsTab={testResultsTabSlot} showTestResults={!isTester} existingSectionNames={existingSectionNames} importSuite={isTester ? undefined : { id: testSuite.id, status: testSuite.status }} />
			</div>
		</div>
	)
}

async function OverviewContent({ suite }: { suite: { id: string; name: string; description: string } }) {
	const overview = await getSuiteOverview(suite.id);
	return <OverviewTab suite={suite} overview={overview} />;
}
