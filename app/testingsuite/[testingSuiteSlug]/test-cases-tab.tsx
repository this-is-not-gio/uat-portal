
import { CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getAllTestCasesBySuiteId, getSectionBySlug, getTestSectionsByTestSuiteId } from "@/lib/supabase/test-sections";
import { getActiveIteration, getIterationChanges, getIterationsBySuiteId, getSectionsByIteration, type iterationSection, type testIteration } from "@/lib/supabase/test-iterations";
import SectionLeaf from "./components/section-leaf";
import ResultLeaf from "./components/result-leaf";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem } from "@/components/ui/combobox";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ChevronRight, FolderOpen, IterationCw, Plus, Upload } from "lucide-react";
import { ROUND_STATUS_LABELS, untestedSectionSlugs } from "@/lib/supabase/case-states";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { Board } from "@/components/board/board";
import { TestCase } from "@/components/types";
import TestCasesComponents, { type authoringContext } from "./test-cases-components";
import SectionDialog from "./components/section-dialog";
import SectionRow from "./components/section-row";
import SectionList from "./components/section-list";
import StartIterationDialog from "./components/start-iteration-dialog";
import { TestIterationComponent } from "./test-iteration-component";
import { TestIterationSection } from "./test-iteration-section";
import { getSuiteTestCaseIssues } from "@/lib/supabase/test-suite";
import type { suiteStatus } from "@/lib/supabase/Init";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IterationSelectionProvider } from "./components/iteration-selection-context";
import TreeCollapsible from "./components/tree-collapsible";

export default async function TestCasesTab({
	testSuiteId,
	testSuiteSlug,
	suiteName,
	suiteStatus,
	sectionPath,
}: {
	testSuiteId: string;
	testSuiteSlug: string;
	suiteName: string;
	suiteStatus: suiteStatus;
	sectionPath?: string[];
}) {



	// Authoring is locked once a suite is signed off or archived (the DB enforces it too).
	const editable = suiteStatus !== "sign_off_issued" && suiteStatus !== "signed_off" && suiteStatus !== "archived";
	// Per-case completeness: drives the Ready/Not ready markers and which cases can be picked for an iteration.
	const showReadiness = editable;

	const [suite, activeIteration, readinessIssues, iterations, sectionsByIteration] = await Promise.all([
		getTestSectionsByTestSuiteId(testSuiteId),
		getActiveIteration(testSuiteId),
		showReadiness ? getSuiteTestCaseIssues(testSuiteId) : Promise.resolve([]),
		getIterationsBySuiteId(testSuiteId),
		getSectionsByIteration(testSuiteId),
	]);

	const iterationSlug = sectionPath?.[0];
	const matchedIteration = iterations.find(i => i.slug === iterationSlug);
	const isIterationView = !!matchedIteration;
	// The round page's Add Section/Add Participant buttons: only on a planned or running round
	// (Add Section is planned-only; IterationTestCaseList hides it once the round starts).
	const matchedIterationOpen = editable && (matchedIteration?.status === "not_started" || matchedIteration?.status === "in_progress");
	const matchedSectionsNotIncluded = matchedIteration && matchedIterationOpen
		? getSectionsNotIncluded(sectionsByIteration.get(matchedIteration.id) ?? [], suite.sections, new Set(readinessIssues.map((issue) => issue.testCaseId)))
		: undefined;
	const sectionSlug = isIterationView ? sectionPath?.[1] : sectionPath?.[0];

	// While a round runs, edits only reach testers through the vendor's Sync.
	// Once it has started its case set is locked (0023): nothing new is added, but content changes
	// sync and removals are flagged for testers (0036).
	const allIterationChanges = activeIteration && editable ? await getIterationChanges(activeIteration.id) : [];
	const iterationChanges = activeIteration?.status === "not_started"
		? allIterationChanges
		: allIterationChanges.filter((change) => change.change !== "added");
	// Mirrors start_iteration's guard: only one round can run at a time, and
	// Draft/Ready suites start theirs from the Test Results tab's own CTA.
	const canStartIteration = !activeIteration && (suiteStatus === "ready" || suiteStatus === "in_testing" || suiteStatus === "sign_off_issued" || suiteStatus === "signed_off");
	const authoring: authoringContext = {
		sync: activeIteration ? { iteration: { id: activeIteration.id, name: activeIteration.name }, changes: iterationChanges } : null,
		suiteId: testSuiteId,
		editable,
		sections: suite.sections.map((section) => ({ id: section.id, name: section.name })),
		readinessIssues: readinessIssues.map((issue) => ({ testCaseId: issue.testCaseId, code: null, issue: issue.issue })),
	};
	const testCaseCounts = new Map(suite.sections.map((section) => [section.id, section.testCases.length]));
	// Sections no round has included yet (0033 rule 3): badged here instead of flagging each case.
	const notTestedSlugs = untestedSectionSlugs(suite.sections.map((section) => section.slug), iterations, sectionsByIteration);
	const addSectionTrigger = (
		<Button>
			<Plus className="h-4 w-4" />
			<p className="text-xs">Add a section</p>
		</Button>
	);
	const data: TreeItem[] = [
		[
			{ name: suite.name, id: suite.id, slug: "all", itemtype: "test-suite" as const },
			...suite.sections.map(section => ({ name: section.name, id: section.id, slug: section.slug, itemtype: "section" as const }))
		]
	];
	return (
		<IterationSelectionProvider>
			<div className="w-100 shrink-0 border-r flex flex-col">
				<Suspense fallback={sideBarSkeleton()}>
					{
						suite.sections.length === 0 ? (
							<div className="flex flex-col flex-1 h-full p-4">
								<p className="text-xs text-muted-foreground font-heading font-medium ">Testing suites</p>
								<div className="flex-1 flex flex-col items-center justify-center gap-5">
									<div className="flex flex-col items-center justify-center text-center gap-5">
										<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
											<FolderOpen size={45} className="text-muted-foreground" />
										</div>
										<div className="flex flex-col items-center justify-center gap-1">
											<p className="font-semibold text-muted-foreground text-lg">No sections yet</p>
											<p className="text-xs text-muted-foreground">Sections will appear here once they&apos;re added to this suite.</p>
										</div>
									</div>
									{editable && <SectionDialog suiteId={testSuiteId} testSuiteSlug={testSuiteSlug} trigger={addSectionTrigger} />}
								</div>
							</div>
						) :
							<SidebarContent>
								{
									suiteStatus !== "draft" &&
									<SidebarGroup className="border-b pb-4">
										<div className="flex flex-row items-center justify-between">
											<SidebarGroupLabel>Test Iterations</SidebarGroupLabel>
											{canStartIteration && (
												<StartIterationDialog
													suiteId={testSuiteId}
													trigger={
														<Button variant="ghost" size="icon" className="size-6" aria-label="Add a test iteration" title="Add a test iteration">
															<Plus className="h-3.5 w-3.5" />
														</Button>
													}
												/>
											)}
										</div>
										<SidebarMenu>
											{
												iterations.length === 0 ? (
													<div className="flex flex-col items-center justify-center text-center gap-3 px-2 py-6">
														<div className="justify-center bg-muted/50 rounded-xl size-12 flex flex-col items-center gap-2">
															<IterationCw size={22} className="text-muted-foreground" />
														</div>
														<div className="flex flex-col items-center justify-center gap-1">
															<p className="font-semibold text-muted-foreground text-sm">No test iterations yet</p>
															<p className="text-xs text-muted-foreground">You may create a test iteration and plan each test cases to be added.</p>
														</div>
													</div>
												) : (
													buildIterationTree(iterations, sectionsByIteration).map((item, index) => (
														<IterationTree
															key={index}
															item={item}
															testSuiteSlug={testSuiteSlug}
															activeIterationSlug={iterationSlug}
															activeSectionSlug={sectionSlug}
														/>
													))
												)
											}
										</SidebarMenu>
									</SidebarGroup>
								}
								<SidebarGroup>
									<div className="flex flex-row items-center justify-between px-2">
										<SidebarGroupLabel className="px-0">Testing Suite</SidebarGroupLabel>
										{editable && <SectionDialog
											suiteId={testSuiteId}
											testSuiteSlug={testSuiteSlug}
											trigger={
												<Button variant="ghost" size="icon" className="size-6" aria-label="Add a section" title="Add a section">
													<Plus className="h-3.5 w-3.5" />
												</Button>
											}
										/>}
									</div>
									<SidebarGroupContent className="">
										<SidebarMenu>
											{
												data.map((item, index) => (
													<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} menu={editable ? { suiteId: testSuiteId, testCaseCounts } : undefined} notTestedSlugs={notTestedSlugs} />
												))
											}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							</SidebarContent>
					}
				</Suspense>
			</div>
			{isIterationView ? (
				sectionSlug ? (
					<TestIterationSection testSuiteId={testSuiteId} suiteName={suiteName} iteration={matchedIteration} sectionSlug={sectionSlug} />
				) : (
					<TestIterationComponent testSuiteId={testSuiteId} testSuiteSlug={testSuiteSlug} suiteName={suiteName} iteration={matchedIteration} sectionsNotIncluded={matchedSectionsNotIncluded} />
				)
			) : (
				<SectionContent testSuiteId={testSuiteId} sectionSlug={sectionSlug} hasSections={suite.sections.length > 0} authoring={authoring} suiteStatus={suiteStatus} sectionNotTestedYet={!!sectionSlug && notTestedSlugs.has(sectionSlug)} />
			)}
		</IterationSelectionProvider>
	)
}

type IterationTreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype: "iteration" | "iteration-section";
	includedCount?: number;
	totalCount?: number;
	// Only set on "iteration" nodes: the round's status badge.
	statusLabel?: string;
	// Only set on "iteration-section" nodes — what a "Remove section" action
	// needs to pull this section's cases back out of the round.
	resultIds?: string[];
	iterationId?: string;
	// Running/completed/stopped rounds: no Edit/Delete/Remove section menu.
	locked?: boolean;
	// Only set on "iteration" nodes: completed/stopped rounds start collapsed.
	collapsed?: boolean;
};

type IterationTreeItem = IterationTreeNode | [IterationTreeNode, ...IterationTreeNode[]];

// Suite sections a round doesn't have yet, with only their complete cases as
// addable — what SectionDialog lists when it's opened for an iteration.
function getSectionsNotIncluded(
	iterationSections: { slug: string }[],
	suiteSections: { id: string; name: string; slug: string; testCases: { id: string }[] }[],
	incompleteCaseIds: Set<string>
) {
	const includedSlugs = new Set(iterationSections.map((s) => s.slug));
	return suiteSections
		.filter((s) => !includedSlugs.has(s.slug))
		.map((s) => ({
			id: s.id,
			name: s.name,
			slug: s.slug,
			testCasesLength: s.testCases.length,
			testCaseIds: s.testCases.filter((tc) => !incompleteCaseIds.has(tc.id)).map((tc) => tc.id),
		}));
}

function buildIterationTree(
	iterations: testIteration[],
	sectionsByIteration: Map<string, iterationSection[]>
): IterationTreeItem[] {
	// The running round first, then a planned one, then finished rounds newest first.
	const statusRank = (status: testIteration["status"]) => status === "in_progress" ? 0 : status === "not_started" ? 1 : 2;
	return [...iterations]
	.sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.startedAt.localeCompare(a.startedAt))
	.map((iteration): IterationTreeItem => {
		const isFinished = iteration.status === "completed" || iteration.status === "stopped";
		// Only a planned round keeps its menus; a running one is locked too, but stays expanded.
		const isLocked = iteration.status !== "not_started";
		const sectionNodes: IterationTreeNode[] = (sectionsByIteration.get(iteration.id) ?? []).map((section) => ({
			name: section.name,
			id: `${iteration.id}:${section.slug}`,
			slug: section.slug,
			itemtype: "iteration-section",
			includedCount: section.includedCount,
			totalCount: section.totalCount,
			resultIds: section.resultIds,
			iterationId: iteration.id,
			locked: isLocked,
		}));

		const iterationNode: IterationTreeNode = {
			name: iteration.name,
			id: iteration.id,
			slug: iteration.slug,
			itemtype: "iteration",
			statusLabel: ROUND_STATUS_LABELS[iteration.status],
			locked: isLocked,
			collapsed: isFinished,
		};
			

			return sectionNodes.length ? [iterationNode, ...sectionNodes] : iterationNode;
		});
}


type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "section" | "test-case" | "test-suite";
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

type sectionMenuContext = { suiteId: string; testCaseCounts: Map<string, number> };

function Tree({ item, testSuiteSlug, menu, notTestedSlugs }: { item: TreeItem; testSuiteSlug: string; menu?: sectionMenuContext; notTestedSlugs: Set<string> }) {
	const [{ name, id, slug, itemtype }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		const notTestedYet = itemtype === "section" && notTestedSlugs.has(slug);
		if (itemtype === "section" && menu) {
			return (
				<SectionRow
					name={name}
					id={id}
					slug={slug}
					testSuiteSlug={testSuiteSlug}
					suiteId={menu.suiteId}
					testCaseCount={menu.testCaseCounts.get(id) ?? 0}
					notTestedYet={notTestedYet}
				/>
			)
		}
		return (
			<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} notTestedYet={notTestedYet} />
		)
	}

	return (
		<SidebarMenuItem>
			<TreeCollapsible
				id={`${testSuiteSlug}:suite:${id}`}
				className="w-full"
				defaultOpen={itemtype === "test-suite"}
			>
				<div className="flex flex-row items-center">
					<CollapsibleTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible">
							<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
						</Button>
					} />
					<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
				</div>
				<CollapsibleContent className="w-full">
					<SidebarMenuSub className="ml-2.5">
						{
							menu && items.every((child): child is TreeNode => !Array.isArray(child) && child.itemtype === "section") ? (
								<SectionList
									sections={items}
									testSuiteSlug={testSuiteSlug}
									suiteId={menu.suiteId}
									testCaseCounts={menu.testCaseCounts}
									notTestedSlugs={notTestedSlugs}
								/>
							) : (
								items.map((item, index) => (
									<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} menu={menu} notTestedSlugs={notTestedSlugs} />
								))
							)
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</TreeCollapsible>
		</SidebarMenuItem>
	)
}

function sideBarSkeleton() {
	return (
		<div className="p-4 gap-2 flex flex-col">
			<h2 className="text-xs">Testing Suite</h2>
			<div className="flex flex-col gap-2" >
				<Skeleton className="h-6" />
				<div className="flex flex-col gap-2 px-4">
					<Skeleton className="h-6 w-1/2" />
					<Skeleton className="h-6 w-1/2" />
				</div>
				<Skeleton className="h-6" />
				<div className="flex flex-col gap-2 px-4">
					<Skeleton className="h-6 w-1/2" />
					<Skeleton className="h-6 w-1/2" />
				</div>

			</div>
		</div>
	)
}

function IterationTree({ item, testSuiteSlug, iterationsSlug, activeIterationSlug, activeSectionSlug }: {
	item: IterationTreeItem;
	testSuiteSlug: string;
	iterationsSlug?: string;
	activeIterationSlug?: string;
	activeSectionSlug?: string;
}) {
	const [{ name, id, slug, itemtype, includedCount, totalCount, statusLabel, collapsed }, ...items] = Array.isArray(item) ? item : [item]
	// Path-based, nested under this same tab (sibling to the normal
	// Testing Suite section view below) rather than the Test Results tab's
	// `?tab=` scheme — see TestCasesTab's sectionPath handling.
	const href = itemtype === "iteration"
		? `/testingsuite/${testSuiteSlug}/${slug}?tab=test-cases`
		: `/testingsuite/${testSuiteSlug}/${iterationsSlug}/${slug}?tab=test-cases`;

	// An iteration is active only with no section picked; a section is active
	// only when both it and its parent iteration match — the same section
	// slug can repeat across multiple iterations, so this can't be derived
	// from the slug alone (see ResultLeaf's own comment on this).
	const active = itemtype === "iteration"
		? slug === activeIterationSlug && !activeSectionSlug
		: iterationsSlug === activeIterationSlug && slug === activeSectionSlug;
	if (!items.length) {
		// No row actions here for now — IterationSectionRow (Remove section) is
		// kept for later; resultIds/iterationId/locked on the node still feed it.
		return <SidebarMenuItem><ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} href={href} active={active} testCaseCount={includedCount} totalCount={totalCount} statusLabel={statusLabel} /></SidebarMenuItem>;
	}

	const header = (
		<div className="flex flex-row items-center">
			<CollapsibleTrigger render={
				<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible">
					<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
				</Button>
			} />
			<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} href={href} active={active} statusLabel={statusLabel} />
		</div>
	);

	return (
		<SidebarMenuItem>
			<TreeCollapsible id={`${testSuiteSlug}:iteration:${id}`} className="w-full" defaultOpen={!collapsed}>
				{header}
				<CollapsibleContent>
					<SidebarMenuSub className="ml-2.5">
						{
							items.map((child, index) => (
								<IterationTree
									key={index}
									item={child}
									testSuiteSlug={testSuiteSlug}
									iterationsSlug={slug}
									activeIterationSlug={activeIterationSlug}
									activeSectionSlug={activeSectionSlug}
								/>
							))
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</TreeCollapsible>
		</SidebarMenuItem>
	);
}


async function SectionContent({ testSuiteId, sectionSlug, hasSections, authoring, suiteStatus, sectionNotTestedYet }: { testSuiteId: string; sectionSlug?: string; hasSections: boolean; authoring: authoringContext; suiteStatus: suiteStatus; sectionNotTestedYet: boolean }) {
	let section;
	if (sectionSlug === "all") {
		section = await getAllTestCasesBySuiteId(testSuiteId);
	} else if (sectionSlug) {
		try {
			section = await getSectionBySlug(testSuiteId, sectionSlug);
		} catch (error) {
			// Slug doesn't match a real section — treat as not selected.
			if ((error as { code?: string })?.code !== "PGRST116") throw error;
		}
	}
	return <TestCasesComponents testCases={section?.testCases || []} section={section} hasSections={hasSections} authoring={authoring} suiteStatus={suiteStatus} sectionNotTestedYet={sectionNotTestedYet} />;
}
