import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getIterationChanges, getIterationResults, getIterationsBySuiteId, getSectionsByIteration, type iterationSection, type testIteration, type testResultRow } from "@/lib/supabase/test-iterations";
import ResultLeaf from "./components/result-leaf";
import TestResultComponents from "./test-result-components";
import StartIterationDialog from "./components/start-iteration-dialog";
import type { suiteStatus } from "@/lib/supabase/Init";
import { ChevronRight, ClipboardList, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "section" | "test-case" | "test-suite" | "iteration";
	// The iteration this node belongs to (its own number for an "iteration"
	// node, its parent's for a "section" node) and whether it's the
	// currently-selected one — both computed server-side, see buildTree.
	iterationNumber?: number;
	active?: boolean;
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

export default async function TestResultTab({
	testSuiteId,
	testSuiteSlug,
	suiteName,
	suiteStatus,
	sectionSlug,
	iterationNumber,
}: {
	testSuiteId: string;
	testSuiteSlug: string;
	suiteName: string;
	suiteStatus: suiteStatus;
	sectionSlug?: string;
	iterationNumber?: string;
}) {
	if (suiteStatus === "draft") {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					<ClipboardList size={45} className="text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">Suite is still in draft</p>
					<p className="text-xs text-muted-foreground">Mark the suite as ready before starting a test iteration.</p>
				</div>
			</div>
		);
	} else if (suiteStatus === "ready") {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					<ClipboardList size={45} className="text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">Ready for testing</p>
					<p className="text-xs text-muted-foreground">Start a test iteration to begin recording results.</p>
				</div>
				<StartIterationDialog
					suiteId={testSuiteId}
					trigger={
						<Button className="flex flex-row items-center gap-2 w-fit">
							<Play className="h-4 w-4" />
							<p className="text-xs">Start Iteration</p>
						</Button>
					}
				/>
			</div>
		);
	}

	const [iterations, sectionsByIteration] = await Promise.all([
		getIterationsBySuiteId(testSuiteId),
		getSectionsByIteration(testSuiteId),
	]);
	const activeIteration = iterations.find((iteration) => iteration.status === "in_progress") ?? null;

	// Explicit ?iteration=N wins; otherwise the running round (that's where
	// testing happens), then the latest completed one.
	const selectedIteration =
		iterations.find((iteration) => String(iteration.iterationNumber) === iterationNumber) ??
		activeIteration ??
		iterations.find((iteration) => iteration.status === "completed") ??
		null;

	// Mirrors start_iteration's guard: Draft and Archived suites can't start a round.
	// (Ready suites are handled by the early return above, with their own Start Testing CTA.)
	const canStartIteration = !activeIteration && (suiteStatus === "in_testing" || suiteStatus === "signed_off");

	const [rawResults, changes] = selectedIteration
		? await Promise.all([
			getIterationResults(selectedIteration.id),
			selectedIteration.status === "in_progress" ? getIterationChanges(selectedIteration.id) : Promise.resolve([]),
		])
		: [[], []];
	// Testers only need to know about edits the vendor can't sync into this round:
	// tested rows whose live case changed ("Outdated") or was deleted ("Removed").
	const pendingByResultId = new Map(
		changes
			.filter((change) => change.testCaseResultId && (change.change === "removed" || change.hasResults))
			.map((change) => [change.testCaseResultId as string, change.change])
	);
	const results = rawResults.map((row) => ({ ...row, pendingChange: pendingByResultId.get(row.id) }));
	const iterationHasResults = results.some((row) =>
		row.status !== "Untested" || (row.stepsToExecute ?? []).some((step) => step.status !== "Untested" || (step.remarks?.length ?? 0) > 0)
	);

	// Same rule as the Test Cases tab: "all" (or no section) shows the whole
	// suite, a section slug narrows the table and the scorecards to it.
	const isAllSections = !sectionSlug || sectionSlug === "all";
	const visibleResults = isAllSections ? results : results.filter((row) => row.sectionSlug === sectionSlug);
	const sectionName = isAllSections
		? "All Sections"
		: results.find((row) => row.sectionSlug === sectionSlug)?.sectionName ?? sectionSlug;

	return (
		<>
			<div className="w-100 shrink-0 border-r flex flex-col">
				<SidebarContent>
					{iterations.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>Test Iterations</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{
										buildTree(iterations, sectionsByIteration, selectedIteration, sectionSlug).map((item, index) => (
											<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} />
										))
									}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}
				</SidebarContent>
			</div>
			{selectedIteration ? (
				<TestResultComponents
					// Remount on iteration/section switch so client state reseeds from the new rows.
					key={`${selectedIteration.id}:${selectedIteration.status}:${sectionSlug ?? "all"}`}
					iteration={selectedIteration}
					testSuiteSlug={testSuiteSlug}
					sectionName={sectionName}
					results={visibleResults}
					iterationHasResults={iterationHasResults}
				/>
			) : (
				<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
					<p className="font-semibold">No test results yet</p>
					<p className="text-xs text-muted-foreground">Results appear here once a test iteration is started for this suite.</p>
					{canStartIteration && (
						<div className="pt-3">
							<StartIterationDialog suiteId={testSuiteId} />
						</div>
					)}
				</div>
			)}
		</>
	);
}

// Iteration → Section: each iteration is a folder, its sections are leaves
// nested under it — mirrors the Test Cases tab's Suite → Section tree, just
// with "iteration" standing in for "suite" as the folder level. Newest
// iteration first.
function buildTree(
	iterations: testIteration[],
	sectionsByIteration: Map<string, iterationSection[]>,
	selectedIteration: testIteration | null,
	sectionSlug: string | undefined,
): TreeItem[] {
	const isAllSections = !sectionSlug || sectionSlug === "all";
	return [...iterations]
		.sort((a, b) => b.iterationNumber - a.iterationNumber)
		.map((iteration): TreeItem => {
			const isSelected = selectedIteration?.id === iteration.id;
			const iterationNode: TreeNode = {
				name: iteration.name,
				id: iteration.id,
				slug: "all",
				itemtype: "iteration",
				iterationNumber: iteration.iterationNumber,
				active: isSelected && isAllSections,
			};
			const sectionNodes: TreeNode[] = (sectionsByIteration.get(iteration.id) ?? []).map((section) => ({
				name: section.name,
				id: `${iteration.id}:${section.slug}`,
				slug: section.slug,
				itemtype: "section",
				iterationNumber: iteration.iterationNumber,
				active: isSelected && sectionSlug === section.slug,
			}));
			return sectionNodes.length ? [iterationNode, ...sectionNodes] : iterationNode;
		});
}

function Tree({ item, testSuiteSlug }: { item: TreeItem; testSuiteSlug: string }) {
	const [{ name, id, slug, itemtype, iterationNumber, active }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		return (
			<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} iterationNumber={iterationNumber} active={active} testSuiteSlug={testSuiteSlug} />
		)
	}

	return (
		<SidebarMenuItem>
			<Collapsible
				className="w-full"
				defaultOpen={itemtype === "iteration" && active}
			>
				<div className="flex flex-row items-center">
					<CollapsibleTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible">
							<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
						</Button>
					} />
					<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} iterationNumber={iterationNumber} active={active} testSuiteSlug={testSuiteSlug} />
				</div>
				<CollapsibleContent>
					<SidebarMenuSub	>
						{
							items.map((item, index) => (
								<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} />
							))
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	)
}
