import { CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getIterationChanges, getIterationResults, getIterationsBySuiteId, getSectionsByIteration, type iterationSection, type testIteration, type testResultRow } from "@/lib/supabase/test-iterations";
import ResultLeaf from "./result-leaf";
import TreeCollapsible from "@/components/testsuite-layout/shared/tree-collapsible";
import { isRemovedFromRound, ROUND_STATUS_LABELS } from "@/lib/supabase/case-states";
import TestResultsComponents, { type participationStatus } from "./test-results-components";
import StartIterationDialog from "@/components/testsuite-layout/shared/start-iteration-dialog";
import { getCurrentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { canWithdrawParticipation, getParticipationProgress, getDraftSignOff, getSignOffContext, unsubmittedParticipantOrgs } from "@/lib/supabase/overview";
import SignOffDialog from "@/components/testsuite-layout/sign-off/sign-off-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ParticipationPanel from "./participation-panel";
import SubmissionBar from "@/components/testsuite-layout/shared/submission-bar";
import SyncBanner from "@/components/testsuite-layout/shared/sync-dialog";
import TestCasesSidebar, { TestCasesSidebarTrigger } from "../test-cases/test-cases-sidebar";
import type { suiteStatus } from "@/lib/supabase/Init";
import { CalendarClock, ChevronRight, FolderPlus, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";

type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "iteration" | "iteration-section";
	// The iteration this node belongs to (its own number for an "iteration"
	// node, its parent's for a section node) and whether it's the
	// currently-selected one — both computed server-side, see buildTree.
	iterationNumber?: number;
	active?: boolean;
	// Same badge + counts as the Test Cases tab's iteration tree.
	statusLabel?: string;
	// Section nodes: tested / in-round cases for the picked participant.
	testedCount?: number;
	includedCount?: number;
	// Only set on "iteration" nodes: finished rounds start collapsed unless selected.
	collapsed?: boolean;
	// Section nodes of a round that hasn't started: nothing to show until it does.
	disabled?: boolean;
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

export default async function TestResultsTab({
	testSuiteId,
	testSuiteSlug,
	suiteName,
	suiteStatus,
	sectionSlug,
	iterationNumber,
	orgId,
}: {
	testSuiteId: string;
	testSuiteSlug: string;
	suiteName: string;
	suiteStatus: suiteStatus;
	sectionSlug?: string;
	iterationNumber?: string;
	// ?org= from the URL; falls back to the viewer's own org, then the first participant.
	orgId?: string;
}) {
	const [iterations, sectionsByIteration] = await Promise.all([
		getIterationsBySuiteId(testSuiteId),
		getSectionsByIteration(testSuiteId),
	]);

	// The open round: planned (not_started) or running (in_progress).
	const activeIteration = iterations.find((iteration) => iteration.status === "not_started" || iteration.status === "in_progress") ?? null;

	// Explicit ?iteration=N wins; otherwise the open round (that's where
	// testing happens), then the latest finished (completed or stopped) one.
	const selectedIteration =
		iterations.find((iteration) => String(iteration.iterationNumber) === iterationNumber) ??
		activeIteration ??
		iterations.find((iteration) => iteration.status === "completed" || iteration.status === "stopped") ??
		null;

	// Mirrors start_iteration's guard: Archived suites can't start a round. (Draft and Ready
	// suites never get here; the route sends them to Overview.)
	const canStartIteration = !activeIteration && (suiteStatus === "in_testing" || suiteStatus === "sign_off_issued" || suiteStatus === "signed_off");

	// Each participant has its own copy of the round, so show one org's rows at a time.
	// Participation carries each org's counts + submission; RLS gives External only its own row.
	const [participants, currentUser] = selectedIteration
		? await Promise.all([getParticipationProgress(selectedIteration.id), getCurrentUser()])
		: [[], null];
	const participantOrgs = participants.map((p) => p.organization);
	const selectedOrg =
		participantOrgs.find((o) => o.id === orgId) ??
		participantOrgs.find((o) => o.id === currentUser?.organization?.id) ??
		participantOrgs[0] ??
		null;

	// The vendor's Sync banner: same changes as the Test Cases tab's (every org; nothing is added
	// once a round starts, 0023, but edits and removals still sync, 0036).
	const showSyncBanner = selectedIteration?.status === "in_progress" && can(currentUser, "sync");
	const [rawResults, changes, orgSectionsByIteration, allChanges] = selectedIteration
		? await Promise.all([
			getIterationResults(selectedIteration.id, selectedOrg?.id),
			selectedIteration.id === activeIteration?.id ? getIterationChanges(selectedIteration.id, selectedOrg?.id) : Promise.resolve([]),
			selectedOrg ? getSectionsByIteration(testSuiteId, selectedOrg.id) : Promise.resolve(null),
			showSyncBanner ? getIterationChanges(selectedIteration.id) : Promise.resolve([]),
		])
		: [[], [], null, []];
	const syncChanges = allChanges.filter((change) => change.change !== "added");
	// Tree counts follow the picked participant (its links keep ?org=); rounds it
	// isn't part of keep the all-participants counts.
	const treeSections = new Map(
		[...sectionsByIteration].map(([iterationId, sections]) => [iterationId, orgSectionsByIteration?.get(iterationId) ?? sections])
	);
	// Testers only need to know about edits the vendor can't sync into this round:
	// tested rows whose live case changed ("Outdated") or was deleted ("Removed").
	const pendingByResultId = new Map(
		changes
			.filter((change) => change.testCaseResultId && (change.change === "removed" || change.hasResults))
			.map((change) => [change.testCaseResultId as string, change.change])
	);
	// Only the cases planned into the round; left-out rows stay out of the table and scorecards.
	// Rows removed mid-round stay listed (flagged, kept out of the scorecards).
	const results = rawResults
		.filter((row) => row.includedInRun || isRemovedFromRound(row))
		.map((row) => ({ ...row, pendingChange: pendingByResultId.get(row.id) }));
	const iterationHasResults = results.some((row) =>
		row.status !== "Untested" || (row.stepsToExecute ?? []).some((step) => step.status !== "Untested" || (step.remarks?.length ?? 0) > 0)
	);

	// Phase 6: External submits its own org's rows; once submitted they're read-only (0014's guard).
	const ownParticipation = participants.find((p) => p.organization.id === currentUser?.organization?.id) ?? null;
	const isViewingOwnOrg = !!ownParticipation && selectedOrg?.id === ownParticipation.organization.id;
	const isOwnOrgSubmitted = isViewingOwnOrg && !!ownParticipation.submittedAt;
	// Whoever is looking, a submitted org's results open read-only. The DB only locks the
	// org's own users (0014); this keeps Admin/Internal from editing them by accident too.
	const selectedParticipation = participants.find((p) => p.organization.id === selectedOrg?.id) ?? null;
	const isSelectedOrgSubmitted = !!selectedParticipation?.submittedAt;
	const participationStatus: participationStatus | null =
		!selectedParticipation || selectedIteration?.status === "not_started" ? null
		: selectedParticipation.submittedAt ? { kind: "submitted", at: selectedParticipation.submittedAt }
		: selectedParticipation.withdrawnAt ? { kind: "withdrawn", at: selectedParticipation.withdrawnAt }
		: selectedIteration?.status === "in_progress" ? { kind: "in_progress", at: null }
		: { kind: "not_submitted", at: null };
	const showSubmission = isViewingOwnOrg && can(currentUser, "submit");
	// Until an Admin/Internal user completes or stops the round (0019).
	const canWithdraw = isOwnOrgSubmitted && can(currentUser, "submit") && !!selectedIteration && await canWithdrawParticipation(selectedIteration.id);
	// Remarks outlive the lock (0020): any started round, own org's rows (Admin: any org's).
	const canRemark = !!selectedIteration && selectedIteration.status !== "not_started" && can(currentUser, "execute")
		&& (isViewingOwnOrg || currentUser?.role === "Admin");
	const showParticipation = can(currentUser, "view_all_results") && participants.length > 0;

	// Header actions. A new round needs the open one finished first (same rule as the empty state).
	const showCreateIteration = canStartIteration && can(currentUser, "run_iteration");
	// Sign-off: vendor only, once no round is open and one has completed. Untested cases still
	// block it (same rule as the DB), so the button stays visible but disabled with the reason.
	const signOffContext = suiteStatus === "in_testing" && can(currentUser, "issue_sign_off")
		? await getSignOffContext(testSuiteId)
		: null;
	const canIssueSignOff = !!signOffContext?.latestCompleted && !signOffContext.hasActiveIteration;
	// The vendor's saved draft (Create sign-off → Issue), so the button continues it instead.
	const draftSignOff = canIssueSignOff ? await getDraftSignOff(testSuiteId) : null;
	const signOffBlockers = signOffContext && signOffContext.openUntestedCases > 0
		? [`${signOffContext.openUntestedCases} test case${signOffContext.openUntestedCases === 1 ? " still needs" : "s still need"} a finished result.`]
		: [];
	const issueSignOffButton = (
		<Button className="text-xs flex-1 md:flex-none" disabled={signOffBlockers.length > 0}>
			<Stamp size={15} />
			{draftSignOff ? "Continue Sign-off" : "Create Sign-off"}
		</Button>
	);
	const headerActions = showCreateIteration || canIssueSignOff ? (
		// Keyed: a server-created element rendered among a client component's static children trips React's dev key check.
		<div key="header-actions" className="flex flex-row items-center gap-1 w-full md:w-auto">
			{showCreateIteration && (
				<StartIterationDialog
					suiteId={testSuiteId}
					testSuiteSlug={testSuiteSlug}
					trigger={
						<Button className="text-xs flex-1 md:flex-none" variant="outline">
							<FolderPlus size={15} />
							Create New Iteration
						</Button>
					}
				/>
			)}
			{canIssueSignOff && signOffContext && (signOffBlockers.length > 0 ? (
				<Tooltip>
					{/* A disabled button gets no pointer events, so the span carries the hover. */}
					<TooltipTrigger render={<span className="inline-flex flex-1 md:flex-none cursor-not-allowed [&>button]:pointer-events-none [&>button]:w-full" tabIndex={0} />}>
						{issueSignOffButton}
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
					suiteId={testSuiteId}
					draft={draftSignOff}
					hasActiveIteration={signOffContext.hasActiveIteration}
					latestCompleted={signOffContext.latestCompleted}
					openUntestedCases={signOffContext.openUntestedCases}
					aiDraftAvailable={!!process.env.GROQ_API_KEY}
					trigger={issueSignOffButton}
				/>
			))}
		</div>
	) : null;

	// Same rule as the Test Cases tab: "all" (or no section) shows the whole
	// suite, a section slug narrows the table and the scorecards to it.
	const isAllSections = !sectionSlug || sectionSlug === "all";
	const visibleResults = isAllSections ? results : results.filter((row) => row.sectionSlug === sectionSlug);
	const sectionName = isAllSections
		? "All Sections"
		: results.find((row) => row.sectionSlug === sectionSlug)?.sectionName ?? sectionSlug;

	return (
		<TestCasesSidebar label="Iterations" sidebar={
				<SidebarContent>
					{iterations.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>Test Iterations</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{
										buildTree(iterations, treeSections, selectedIteration, sectionSlug).map((item, index) => (
											<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} />
										))
									}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}
				</SidebarContent>
			}>
			{selectedIteration?.status === "not_started" ? (
				// A planned round has no results yet: no table or overview until it starts.
				<div className="flex-1 flex items-center justify-center h-full">
					<div className="flex flex-col items-center justify-center text-center gap-5 py-12">
						<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
							<CalendarClock size={45} className="text-muted-foreground" />
						</div>
						<div className="flex flex-col items-center justify-center gap-1">
							<p className="font-semibold text-muted-foreground text-lg">{selectedIteration.name} hasn&apos;t started yet</p>
							<p className="text-xs text-muted-foreground">Results appear here once the iteration starts.</p>
						</div>
						<TestCasesSidebarTrigger withLabel />
					</div>
				</div>
			) : selectedIteration ? (
				<TestResultsComponents
					// Remount on iteration/section/org switch so client state reseeds from the new rows.
					key={`${selectedIteration.id}:${selectedIteration.status}:${sectionSlug ?? "all"}:${selectedOrg?.id ?? ""}`}
					iteration={selectedIteration}
					testSuiteSlug={testSuiteSlug}
					sectionName={sectionName}
					results={visibleResults}
					iterationHasResults={iterationHasResults}
					isLocked={isSelectedOrgSubmitted}
					canRemark={canRemark}
					unsubmittedOrgs={unsubmittedParticipantOrgs(participants)}
					participantOrgs={participantOrgs}
					selectedOrgId={selectedOrg?.id ?? null}
					participationStatus={participationStatus}
					headerActions={headerActions}
					syncBanner={showSyncBanner && syncChanges.length > 0 ? (
						// Keyed: a server-created element rendered among a client component's static children trips React's dev key check.
						<SyncBanner key="sync-banner" iteration={{ id: selectedIteration.id, name: selectedIteration.name }} changes={syncChanges} />
					) : null}
					participation={showParticipation ? <ParticipationPanel participation={participants} selectedOrgId={selectedOrg?.id ?? null} /> : null}
					submission={showSubmission && ownParticipation ? (
						<SubmissionBar
							iteration={selectedIteration}
							organizationName={ownParticipation.organization.name}
							counts={ownParticipation.counts}
							submittedAt={ownParticipation.submittedAt}
							canWithdraw={canWithdraw}
							untestedCases={results
								.filter((row) => row.status === "Untested" || row.status === "In Progress")
								.map((row) => ({ id: row.id, code: row.code ?? null, title: row.title, sectionName: row.sectionName }))}
						/>
					) : null}
				/>
			) : (
				<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
					<p className="font-semibold">No test results yet</p>
					<p className="text-xs text-muted-foreground">Results appear here once a test iteration is started for this suite.</p>
					<div className="pt-3"><TestCasesSidebarTrigger withLabel /></div>
					{canStartIteration && (
						<div className="pt-3">
							<StartIterationDialog suiteId={testSuiteId} testSuiteSlug={testSuiteSlug} />
						</div>
					)}
				</div>
			)}
		</TestCasesSidebar>
	);
}

// Iteration → Section: each iteration is a folder, its sections are leaves
// nested under it — mirrors the Test Cases tab's Suite → Section tree, just
// with "iteration" standing in for "suite" as the folder level. Newest
// iteration first. Ordered and badged like the Test Cases tab's iteration
// tree: running round, then a planned one, then finished rounds newest first.
function buildTree(
	iterations: testIteration[],
	sectionsByIteration: Map<string, iterationSection[]>,
	selectedIteration: testIteration | null,
	sectionSlug: string | undefined,
): TreeItem[] {
	const isAllSections = !sectionSlug || sectionSlug === "all";
	const statusRank = (status: testIteration["status"]) => status === "in_progress" ? 0 : status === "not_started" ? 1 : 2;
	return [...iterations]
		.sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.iterationNumber - a.iterationNumber)
		.map((iteration): TreeItem => {
			const isSelected = selectedIteration?.id === iteration.id;
			const isFinished = iteration.status === "completed" || iteration.status === "stopped";
			const iterationNode: TreeNode = {
				name: iteration.name,
				id: iteration.id,
				slug: "all",
				itemtype: "iteration",
				iterationNumber: iteration.iterationNumber,
				active: isSelected && isAllSections,
				statusLabel: ROUND_STATUS_LABELS[iteration.status],
				collapsed: isFinished && !isSelected,
			};
			const sectionNodes: TreeNode[] = (sectionsByIteration.get(iteration.id) ?? []).map((section) => ({
				name: section.name,
				id: `${iteration.id}:${section.slug}`,
				slug: section.slug,
				itemtype: "iteration-section",
				iterationNumber: iteration.iterationNumber,
				active: isSelected && sectionSlug === section.slug,
				testedCount: section.testedCount,
				includedCount: section.includedCount,
				disabled: iteration.status === "not_started",
			}));
			return sectionNodes.length ? [iterationNode, ...sectionNodes] : iterationNode;
		});
}

function Tree({ item, testSuiteSlug }: { item: TreeItem; testSuiteSlug: string }) {
	const [{ name, id, slug, itemtype, iterationNumber, active, statusLabel, testedCount, includedCount, collapsed, disabled }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		return (
			<SidebarMenuItem>
				<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} iterationNumber={iterationNumber} active={active} testSuiteSlug={testSuiteSlug} statusLabel={statusLabel} testCaseCount={testedCount} totalCount={includedCount} disabled={disabled} title={disabled ? "Available once the iteration starts" : itemtype === "iteration-section" ? `${testedCount ?? 0} of ${includedCount ?? 0} tested` : undefined} />
			</SidebarMenuItem>
		)
	}

	return (
		<SidebarMenuItem>
			<TreeCollapsible id={`${testSuiteSlug}:result-iteration:${id}`} className="w-full" defaultOpen={!collapsed}>
				<div className="flex flex-row items-center">
					<CollapsibleTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible">
							<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
						</Button>
					} />
					<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} iterationNumber={iterationNumber} active={active} testSuiteSlug={testSuiteSlug} statusLabel={statusLabel} />
				</div>
				<CollapsibleContent>
					<SidebarMenuSub className="ml-2.5">
						{
							items.map((item, index) => (
								<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} />
							))
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</TreeCollapsible>
		</SidebarMenuItem>
	)
}
