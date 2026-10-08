
import { ImportStagingProvider } from "@/components/testsuite-layout/test-cases/import-staging";
import { statusMapping } from "@/components/testsuite-layout/suite-status-badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDraftSignOff, getPendingSignOff, getSignOffContext, getSuiteSignOffs } from "@/lib/supabase/overview";
import { getSuiteReadinessIssues, getSuiteScope, getTestSuiteBySlug, readinessIssue, suiteScope } from "@/lib/supabase/test-suite";
import { cn } from "cn";
import { ChartColumn, Circle, CircleCheck, ClipboardEdit, FolderClock, MoreVertical, Stamp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import SuiteStatusButton from "@/components/testsuite-layout/shared/suite-status-button";
import { testCasesHref } from "@/components/testsuite-layout/test-cases/href";
import SuiteTabs from "../../../../components/testsuite-layout/suite-tabs";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
import StartIterationDialog from "@/components/testsuite-layout/shared/start-iteration-dialog";
import type { iterationStatus } from "@/lib/supabase/test-iterations";
import { TruncatedText } from "@/components/sidebar/nav-secondary";
import { SignOffStatusBadge } from "@/components/testsuite-layout/sign-off/sign-off-status-badge";
import { AcknowledgeSignOffDialog, RejectSignOffDialog } from "@/components/testsuite-layout/sign-off/sign-off-dialog";
import BackToTestingButton from "@/components/testsuite-layout/sign-off/back-to-testing-button";
import DraftSignOffButton from "@/components/testsuite-layout/sign-off/draft-sign-off-button";


// Header pill for the suite's current round: planning (amber) → testing (blue) → completed (green).
// Only open rounds pulse.
const ITERATION_PILL: Record<iterationStatus, { label: string; className: string; dot: string; ping?: string }> = {
	not_started: { label: "Planning", className: "bg-yellow-500/10 text-amber-700", dot: "bg-amber-600", ping: "bg-amber-400" },
	in_progress: { label: "Testing", className: "bg-blue-500/10 text-blue-700", dot: "bg-blue-600", ping: "bg-blue-400" },
	completed: { label: "Completed", className: "bg-green-500/10 text-green-800", dot: "bg-green-700" },
	stopped: { label: "Stopped", className: "bg-gray-500/10 text-gray-700", dot: "bg-gray-600" },
};

export default async function TestSuiteLayout({ children, params }: LayoutProps<"/testsuite/[testSuiteSlug]">) {
	const slug = await params
	const testSuite = await getTestSuiteBySlug(slug.testSuiteSlug);
	if (!testSuite) {
		notFound();
	}
	// cache()'d, so this reuses the (app) layout's lookup instead of refetching.
	const currentUser = await getCurrentUser();
	const [draftIssues, scope, allSignOffs] = await Promise.all([
		testSuite.status === "draft" ? getSuiteReadinessIssues(testSuite.id) : Promise.resolve([]),
		getSuiteScope(testSuite.id),
		can(currentUser, "view_all_results") && testSuite.status !== "draft" && testSuite.status !== "ready"
			? getSuiteSignOffs(testSuite.id) : Promise.resolve([]),
	]);
	const canMarkReady = draftIssues.length === 0;
	const isTester = currentUser?.role === "Internal" || currentUser?.role === "External";
	const reportSignOffs = allSignOffs.filter((s) => s.hasReport);
	const plannedRound = testSuite.status === "ready"
		? testSuite.iterations
			.filter((i) => i.status === "not_started")
			.sort((a, b) => b.iterationNumber - a.iterationNumber)[0] ?? null
		: null;
	const activeRound = testSuite.status === "in_testing"
		? testSuite.iterations.find((i) => i.status === "in_progress") ?? null
		: null;
	// Also loaded on a rejected suite: the vendor can draft a new report from there.
	const signOffContext = testSuite.status === "in_testing" || testSuite.status === "for_sign_off" || testSuite.status === "sign_off_rejected"
		? await getSignOffContext(testSuite.id, currentUser?.organization?.id) : null;
	const currentIteration = signOffContext?.currentIteration?.iteration ?? null;
	const iterationPill = currentIteration ? ITERATION_PILL[currentIteration.status] : null;
	// The vendor's issued sign-off the client (Internal) acknowledges or rejects.
	const pendingSignOff = testSuite.status === "sign_off_issued" && can(currentUser, "sign_off") ? await getPendingSignOff(testSuite.id) : null;
	// Sign-off flow: Create draft (suite For Sign-off, yellow) → Issue (blue) → Acknowledge | Reject (red). Drafts are vendor-only.
	const canIssueSignOff = can(currentUser, "issue_sign_off");
	const draftSignOff = testSuite.status === "for_sign_off" && canIssueSignOff ? await getDraftSignOff(testSuite.id) : null;
	// The tab opens once a report is frozen, or as soon as the vendor creates a draft.
	const showSignOffTab = reportSignOffs.length > 0 || !!draftSignOff;
	const rejectedSignOff = testSuite.status === "sign_off_rejected" ? allSignOffs.find((s) => s.status === "rejected") ?? null : null;
	// Create sign-off needs every round finished, at least one completed, and no case left without
	// a finished result (same rule as the Test Results tab's button).
	const canCreateSignOff = canIssueSignOff && !!signOffContext && !signOffContext.hasActiveIteration
		&& !!signOffContext.latestCompleted && signOffContext.openUntestedCases === 0;

	const { Icon, label, className, IconColor, nextStatusIcon: NextIcon } = statusMapping[testSuite.status];

	return (
		// The app shell clips overflow (body is overflow-hidden), so the suite page is its own scroll container.
		// min-h-0 + flex-1 give the ScrollArea a bounded height; without it the viewport never overflows.

		<div className="flex min-h-0 flex-1 flex-col print:block">
			{/* Header */}
			<div className="p-6 flex-row flex justify-between gap-2 sm:gap-1 items-end print:hidden">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full">
					<div className="flex flex-row gap-2 items-center shrink-0">
						<div className={cn("w-12 h-12 shrink-0 bg-primary rounded-md flex items-center justify-center border", statusMapping[testSuite.status].className)}>
							<Icon className={IconColor} />
						</div>
						<div className="flex flex-col gap-1">
							<div className="flex flex-row gap-1 items-center whitespace-nowrap">
								<p className="font-heading font-bold text-lg leading-none">{testSuite.name}</p>
							</div>
							<p className="text-xs text-muted-foreground font-medium">{label} Test Suite</p>
						</div>
					</div>
					<div className="flex flex-row items-center gap-5 w-full lg:w-auto">
						{
							testSuite.status === "draft" ?
								<div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-4">
									<div className="grid gap-3 grid-cols-2 lg:flex lg:flex-row lg:items-center lg:gap-4">
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
								</div> :
								testSuite.status === "ready" ?
									<div className="flex flex-row items-center justify-between gap-2 w-full">
										<div className="flex flex-col gap-1">
											<p className="text-xs font-medium text-muted-foreground">Test Iteration</p>
											{
												plannedRound ?
													<div className="flex flex-row items-center gap-1.5 py-1.5 px-3 rounded-md bg-yellow-500/10 text-amber-700">
														<span className="relative flex size-2">
															<span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-60 motion-safe:animate-ping" />
															<span className="relative inline-flex size-2 rounded-full bg-amber-600" />
														</span>
														<p className="text-xs font-semibold">{plannedRound.name} - Planning</p>
													</div>
													:
													<div className="flex flex-row items-center gap-1.5 py-1.5 px-3 rounded-md bg-gray-500/10 text-gray-700">
														<span className="relative flex size-2">
															{/* <span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-60 motion-safe:animate-ping" /> */}
															<span className="relative inline-flex size-2 rounded-full bg-gray-600" />
														</span>
														<p className="font-semibold text-xs font-mono">No Iteration yet</p>
													</div>

											}
										</div>
										<div className="self-end" >
											{plannedRound ? (
												<Button nativeButton={false} render={<Link href={testCasesHref(slug.testSuiteSlug, plannedRound.slug)} />} className="flex flex-row items-center gap-2 ">
													<ClipboardEdit className="h-4 w-4" />
													<p className="text-xs">Start Testing</p>
												</Button>
											) : (
												<StartIterationDialog
													suiteId={testSuite.id}
													testSuiteSlug={testSuite.slug}
													trigger={
														<Button className="flex flex-row items-center gap-2 ">
															<ClipboardEdit className="h-4 w-4" />
															<p className="text-xs">Start Testing</p>
														</Button>
													}
												/>
											)}
										</div>
									</div> :

									testSuite.status === "in_testing" ?
										<div className="flex flex-row items-center justify-between gap-2 w-full">
											<div className="flex flex-col gap-1">
												<p className="text-xs font-medium text-muted-foreground">{
													currentIteration ? "Current Test Iteration" : "Test Iteration"
												}</p>
												{
													currentIteration && iterationPill ?
														<div className={cn("flex flex-row items-center gap-1.5 py-1.5 px-3 rounded-md", iterationPill.className)}>
															<span className="relative flex size-2">
																{iterationPill.ping && <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", iterationPill.ping)} />}
																<span className={cn("relative inline-flex size-2 rounded-full", iterationPill.dot)} />
															</span>
															<TruncatedText text={currentIteration.name} className="text-xs font-semibold" />
															<span className="text-xs font-semibold shrink-0">- {iterationPill.label}</span>
														</div>
														:
														<div className="flex flex-row items-center gap-1.5 py-1.5 px-3 rounded-md bg-gray-500/10 text-gray-700">
															<span className="relative flex size-2">
																{/* <span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-60 motion-safe:animate-ping" /> */}
																<span className="relative inline-flex size-2 rounded-full bg-gray-600" />
															</span>
															<p className="font-semibold text-xs font-mono">No Iteration yet</p>
														</div>

												}
											</div>
											<div className="self-end flex flex-row items-center gap-2" >
												{activeRound && !isTester ? (
													<Button nativeButton={false} render={<Link href={testCasesHref(slug.testSuiteSlug, activeRound.slug)} />} className="flex flex-row items-center gap-2 ">
														<FolderClock className="h-4 w-4" />
														<p className="text-xs">Manage Iteration</p>
													</Button>
												) : currentIteration?.status === "completed" && !isTester ? (
													// A finished round: review its results (sign-off is issued from there).
													<Button nativeButton={false} render={<Link href={testResultsHref(slug.testSuiteSlug, "all", { iteration: currentIteration.iterationNumber })} />} className="flex flex-row items-center gap-2 ">
														<ChartColumn className="h-4 w-4" />
														<p className="text-xs">Review Results</p>
													</Button>
												) : null}
											</div>
										</div>
										: testSuite.status === "for_sign_off" || testSuite.status === "sign_off_issued" || testSuite.status === "signed_off" ?
											<div className="flex flex-row items-center justify-between gap-2 w-full">
												<div className="flex flex-col gap-1">
													<p className="text-xs font-medium text-muted-foreground">Sign-off Status</p>
													{/* For Sign-off: the vendor is drafting. Issued: the client still has to acknowledge it. */}
													<SignOffStatusBadge
														status={testSuite.status === "for_sign_off" ? "drafting" : testSuite.status === "signed_off" ? "acknowledged" : currentUser?.role === "Admin" ? "issued" : "awaiting_acknowledgement"}
													/>
												</div>
												<div className="self-end flex flex-row items-center gap-2">
													{draftSignOff && <BackToTestingButton signOffId={draftSignOff.id} />}
													{/* The draft is edited in the Sign-off tab, which opens it by default. */}
													{draftSignOff && (
														<Button nativeButton={false} render={<Link href={`/testsuite/${testSuite.slug}/sign-off`} />} className="flex flex-row items-center gap-2">
															<Stamp className="h-4 w-4" />
															<p className="text-xs">Draft Sign-off Report</p>
														</Button>
													)}
													{pendingSignOff && (
														<RejectSignOffDialog
															suiteId={testSuite.id}
															signOff={pendingSignOff}
															trigger={
																<Button variant="outline" className="flex flex-row items-center gap-2">
																	<p className="text-xs">Reject</p>
																</Button>
															}
														/>
													)}
													{pendingSignOff ? (
														<AcknowledgeSignOffDialog
															suiteId={testSuite.id}
															signOff={pendingSignOff}
															reportHref={pendingSignOff.hasReport ? `/testsuite/${testSuite.slug}/sign-off?signOff=${pendingSignOff.id}` : null}
															trigger={
																<Button className="flex flex-row items-center gap-2">
																	{NextIcon && <NextIcon className="h-4 w-4" />}
																	<p className="text-xs">Acknowledge Sign-off</p>
																</Button>
															}
														/>
													) : testSuite.status === "signed_off" && can(currentUser, "archive") ? (
														<SuiteStatusButton suiteId={testSuite.id} targetStatus="archived">
															{NextIcon && <NextIcon className="h-4 w-4" />}
															<p className="text-xs">Archive</p>
														</SuiteStatusButton>
													) : null}
												</div>
											</div>
											: testSuite.status === "sign_off_rejected" ?
												<div className="flex flex-row items-center justify-between gap-4 w-full">
													<div className="flex min-w-0 flex-col gap-1">
														<p className="text-xs font-medium text-muted-foreground">Sign-off Status</p>
														<SignOffStatusBadge status="rejected" />
													</div>
													{/* The vendor decides what happens next: reopen testing, or draft a new report. */}
													{canIssueSignOff && (
														<div className="self-end flex flex-row items-center gap-2">
															<SuiteStatusButton suiteId={testSuite.id} targetStatus="in_testing" variant="outline">
																<p className="text-xs">Open for Testing</p>
															</SuiteStatusButton>
															{canCreateSignOff && <DraftSignOffButton suiteId={testSuite.id} testSuiteSlug={testSuite.slug} />}
														</div>
													)}
												</div>
												: testSuite.status === "archived" && can(currentUser, "archive") ?
													<div className="flex flex-row justify-end w-full">
														<SuiteStatusButton suiteId={testSuite.id} targetStatus="signed_off" variant="outline">
															<p className="text-xs">Unarchive</p>
														</SuiteStatusButton>
													</div>
													: null
						}
					</div>
				</div>
				<Button variant="outline" size="icon" >
					<MoreVertical />
				</Button>
			</div>
			{/* Tabs */}
			<div className="contents print:hidden">
				<SuiteTabs suiteSlug={testSuite.slug} showTestResults={!isTester && testSuite.status !== "draft" && testSuite.status !== "ready"} showSignOff={showSignOffTab} />
			</div>
			<ScrollArea className="min-h-0 flex-1">
				{/* Content. The staged import lives here so it survives switching tabs. */}
				<ImportStagingProvider>{children}</ImportStagingProvider>
			</ScrollArea>
		</div>
	)
}

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
