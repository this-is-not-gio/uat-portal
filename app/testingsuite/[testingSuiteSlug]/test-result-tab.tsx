import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getIterationChanges, getIterationResults, getIterationsBySuiteId, type testResultRow } from "@/lib/supabase/test-iterations";
import IterationSelect from "./components/iteration-select";
import ResultLeaf from "./components/result-leaf";
import TestResultComponents from "./test-result-components";
import StartIterationDialog from "./components/start-iteration-dialog";
import type { suiteStatus } from "@/lib/supabase/Init";
import { ClipboardList, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "section" | "test-case" | "test-suite";
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
					testSuiteSlug={testSuiteSlug}
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

	const iterations = await getIterationsBySuiteId(testSuiteId);
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
					<SidebarGroup className="border-b pb-4">
						<SidebarGroupLabel>Test Results</SidebarGroupLabel>
						<SidebarGroupContent>
							<div className="px-2 flex flex-col gap-2">
								<IterationSelect iterations={iterations} selectedIteration={selectedIteration} />
								{canStartIteration && iterations.length > 0 && (
									<StartIterationDialog suiteId={testSuiteId} testSuiteSlug={testSuiteSlug} />
								)}
							</div>
						</SidebarGroupContent>
					</SidebarGroup>
					{selectedIteration && (
						<SidebarGroup>
							<SidebarGroupLabel>Testing Suite</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{
										buildTree(suiteName, results).map((item, index) => (
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
							<StartIterationDialog suiteId={testSuiteId} testSuiteSlug={testSuiteSlug} />
						</div>
					)}
				</div>
			)}
		</>
	);
}

// Suite → sections, built from the iteration's snapshot so the tree shows
// what was actually tested, not the live suite. Kept flat at 2 levels for
// now — sections don't list their individual test cases yet.
function buildTree(suiteName: string, rows: testResultRow[]): TreeItem[] {
	// Rows arrive sorted by section order, so first-seen order is the section order.
	const sections = new Map<string, string>();
	for (const row of rows) {
		if (row.sectionSlug && !sections.has(row.sectionSlug)) {
			sections.set(row.sectionSlug, row.sectionName ?? row.sectionSlug);
		}
	}
	return [
		[
			{ name: suiteName, id: "suite", slug: "all", itemtype: "test-suite" },
			...Array.from(sections, ([slug, name]): TreeNode => ({ name, id: slug, slug, itemtype: "section" })),
		],
	];
}

function Tree({ item, testSuiteSlug }: { item: TreeItem; testSuiteSlug: string }) {
	const [{ name, id, slug, itemtype }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		return (
			<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
		)
	}

	return (
		<SidebarMenuItem>
			<Collapsible
				className="w-full"
				defaultOpen={itemtype === "test-suite"}
			>
				<CollapsibleTrigger render={
					<ResultLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
				} />
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
