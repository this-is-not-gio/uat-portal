
import { CollapsibleContent, CollapsibleTrigger, Collapsible } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getAllTestCasesBySuiteId, getSectionBySlug, getTestSectionsByTestSuiteId } from "@/lib/supabase/test-sections";
import { getActiveIteration, getIterationChanges, getIterationsBySuiteId, getSectionsByIteration, type iterationSection, type testIteration } from "@/lib/supabase/test-iterations";
import SectionLeaf from "./components/section-leaf";
import ResultLeaf from "./components/result-leaf";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem } from "@/components/ui/combobox";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ChevronRight, FolderOpen, IterationCw, Plus, Upload } from "lucide-react";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { Board } from "@/components/board/board";
import { TestCase } from "@/components/types";
import TestCasesComponents, { type authoringContext } from "./test-cases-components";
import SectionDialog from "./components/section-dialog";
import SectionRow from "./components/section-row";
import SectionList from "./components/section-list";
import StartIterationDialog from "./components/start-iteration-dialog";
import IterationRow from "./components/iteration-row";
import IterationSectionRow from "./components/iteration-section-row";
import { TestIterationComponent } from "./test-iteration-component";
import { TestIterationSection } from "./test-iteration-section";
import { getSuiteTestCaseIssues } from "@/lib/supabase/test-suite";
import type { suiteStatus } from "@/lib/supabase/Init";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IterationSelectionProvider } from "./components/iteration-selection-context";

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
	const editable = suiteStatus !== "signed_off" && suiteStatus !== "archived";
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
	const sectionSlug = isIterationView ? sectionPath?.[1] : sectionPath?.[0];

	// While a round runs, edits only reach testers through the vendor's Sync.
	const iterationChanges = activeIteration && editable ? await getIterationChanges(activeIteration.id) : [];
	// Mirrors start_iteration's guard: only one round can run at a time, and
	// Draft/Ready suites start theirs from the Test Results tab's own CTA.
	const canStartIteration = !activeIteration && (suiteStatus === "ready" || suiteStatus === "in_testing" || suiteStatus === "signed_off");
	const authoring: authoringContext = {
		sync: activeIteration ? { iteration: { id: activeIteration.id, name: activeIteration.name }, changes: iterationChanges } : null,
		suiteId: testSuiteId,
		editable,
		sections: suite.sections.map((section) => ({ id: section.id, name: section.name })),
		readinessIssues: readinessIssues.map((issue) => ({ testCaseId: issue.testCaseId, code: null, issue: issue.issue })),
	};
	const testCaseCounts = new Map(suite.sections.map((section) => [section.id, section.testCases.length]));
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
													buildIterationTree(iterations, sectionsByIteration, suite.sections, readinessIssues).map((item, index) => (
														<IterationTree
															key={index}
															item={item}
															testSuiteId={testSuiteId}
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
													<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} menu={editable ? { suiteId: testSuiteId, testCaseCounts } : undefined} />
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
					<TestIterationSection suiteName={suiteName} iteration={matchedIteration} sectionSlug={sectionSlug} />
				) : (
					<TestIterationComponent testSuiteId={testSuiteId} suiteName={suiteName} iteration={matchedIteration} />
				)
			) : (
				<SectionContent testSuiteId={testSuiteId} sectionSlug={sectionSlug} hasSections={suite.sections.length > 0} authoring={authoring} suiteStatus={suiteStatus} />
			)}
		</IterationSelectionProvider>
	)
}

type IterationTreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype: "iteration" | "iteration-section";
	// Only set on the "iteration" node itself — its section children aren't
	// independently editable/deletable entities, so they don't need it.
	iteration?: testIteration;
	includedCount?: number;
	// Only set on "iteration-section" nodes — what a "Remove section" action
	// needs to pull this section's cases back out of the round.
	resultIds?: string[];
	iterationId?: string;
	sectionsNotIncluded?: { id: string; name: string; slug: string; testCasesLength: number; testCaseIds: string[] }[];
};

type IterationTreeItem = IterationTreeNode | [IterationTreeNode, ...IterationTreeNode[]];

function buildIterationTree(
	iterations: testIteration[],
	sectionsByIteration: Map<string, iterationSection[]>,
	suiteSections: { id: string; name: string; slug: string; testCases: { id: string }[] }[],
	readinessIssues: { testCaseId: string }[]
): IterationTreeItem[] {
	// Only complete cases are safe to sync into a round — same rule
	// start_iteration/AddTestCasesControl already enforce.
	const incompleteCaseIds = new Set(readinessIssues.map((issue) => issue.testCaseId));

	return [...iterations]
	.sort((a, b) => b.iterationNumber - a.iterationNumber)
	.map((iteration): IterationTreeItem => {
		const sectionNodes: IterationTreeNode[] = (sectionsByIteration.get(iteration.id) ?? []).map((section) => ({
			name: section.name,
			id: `${iteration.id}:${section.slug}`,
			slug: section.slug,
			itemtype: "iteration-section",
			includedCount: section.includedCount,
			resultIds: section.resultIds,
			iterationId: iteration.id,
		}));

		const includedSlugs = new Set(sectionNodes.map((s) => s.slug));
		const sectionsNotIncluded = suiteSections
			.filter((s) => !includedSlugs.has(s.slug))
			.map((s) => ({
				id: s.id,
				name: s.name,
				slug: s.slug,
				testCasesLength: s.testCases.length,
				testCaseIds: s.testCases.filter((tc) => !incompleteCaseIds.has(tc.id)).map((tc) => tc.id),
			}));

		const iterationNode: IterationTreeNode = {
			name: iteration.name,
			id: iteration.id,
			slug: iteration.slug,
			itemtype: "iteration",
			iteration,
			sectionsNotIncluded,
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

function Tree({ item, testSuiteSlug, menu }: { item: TreeItem; testSuiteSlug: string; menu?: sectionMenuContext }) {
	const [{ name, id, slug, itemtype }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		if (itemtype === "section" && menu) {
			return (
				<SectionRow
					name={name}
					id={id}
					slug={slug}
					testSuiteSlug={testSuiteSlug}
					suiteId={menu.suiteId}
					testCaseCount={menu.testCaseCounts.get(id) ?? 0}
				/>
			)
		}
		return (
			<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
		)
	}

	return (
		<SidebarMenuItem>
			<Collapsible
				className="w-full"
				defaultOpen={itemtype === "test-suite"}
			>
				<div className="flex flex-row items-center">
					<CollapsibleTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible p-4">
							<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
						</Button>
					} />
					<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
				</div>
				<CollapsibleContent>
					<SidebarMenuSub	>
						{
							menu && items.every((child): child is TreeNode => !Array.isArray(child) && child.itemtype === "section") ? (
								<SectionList
									sections={items}
									testSuiteSlug={testSuiteSlug}
									suiteId={menu.suiteId}
									testCaseCounts={menu.testCaseCounts}
								/>
							) : (
								items.map((item, index) => (
									<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} menu={menu} />
								))
							)
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
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

function IterationTree({ item, testSuiteId, testSuiteSlug, iterationsSlug, activeIterationSlug, activeSectionSlug }: {
	item: IterationTreeItem;
	testSuiteId: string;
	testSuiteSlug: string;
	iterationsSlug?: string;
	activeIterationSlug?: string;
	activeSectionSlug?: string;
}) {
	const [{ name, id, slug, itemtype, iteration, sectionsNotIncluded, includedCount, resultIds, iterationId }, ...items] = Array.isArray(item) ? item : [item]
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
	// Both "iteration" and "iteration-section" nodes get a hover-reveal menu
	// (Edit/Delete iteration, Remove section) — leave room for it.
	const resultLeafClassName = itemtype === "iteration" || itemtype === "iteration-section" ? "group-has-data-[sidebar=menu-action]/menu-item:pr-14" : undefined;

	if (!items.length) {
		const leaf = <ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} href={href} active={active} className={resultLeafClassName} testCaseCount={includedCount} />;
		if (itemtype === "iteration" && iteration) {
			return <IterationRow iteration={iteration} suiteId={testSuiteId} testSuiteSlug={testSuiteSlug} sectionsNotIncluded={sectionsNotIncluded}>{leaf}</IterationRow>;
		}
		if (itemtype === "iteration-section" && iterationId && resultIds) {
			return <IterationSectionRow iterationId={iterationId} sectionName={name} resultIds={resultIds}>{leaf}</IterationSectionRow>;
		}
		return leaf;
	}

	const headerContent = (
		<>
			<CollapsibleTrigger render={
				<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible p-4">
					<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
				</Button>
			} />
			<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} href={href} active={active} className={resultLeafClassName} />
		</>
	);
	// IterationRow only wraps this header line, never the CollapsibleContent
	// below — that's what keeps hovering a child section from bubbling up and
	// revealing the parent iteration's own Edit/Delete menu.
	const header = itemtype === "iteration" && iteration
		? <IterationRow iteration={iteration} suiteId={testSuiteId} testSuiteSlug={testSuiteSlug} sectionsNotIncluded={sectionsNotIncluded}>{headerContent}</IterationRow>
		: <div className="flex flex-row items-center">{headerContent}</div>;

	return (
		<SidebarMenuItem>
			<Collapsible className="w-full" defaultOpen>
				{header}
				<CollapsibleContent>
					<SidebarMenuSub>
						{
							items.map((child, index) => (
								<IterationTree
									key={index}
									item={child}
									testSuiteId={testSuiteId}
									testSuiteSlug={testSuiteSlug}
									iterationsSlug={slug}
									activeIterationSlug={activeIterationSlug}
									activeSectionSlug={activeSectionSlug}
								/>
							))
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
}


async function SectionContent({ testSuiteId, sectionSlug, hasSections, authoring, suiteStatus }: { testSuiteId: string; sectionSlug?: string; hasSections: boolean; authoring: authoringContext; suiteStatus: suiteStatus }) {
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
	return <TestCasesComponents testCases={section?.testCases || []} section={section} hasSections={hasSections} authoring={authoring} suiteStatus={suiteStatus} />;
}
