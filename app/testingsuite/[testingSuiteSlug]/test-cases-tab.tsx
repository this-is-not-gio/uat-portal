
import { CollapsibleContent, CollapsibleTrigger, Collapsible } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getAllTestCasesBySuiteId, getSectionBySlug, getTestSectionsByTestSuiteId } from "@/lib/supabase/test-sections";
import { getActiveIteration, getIterationChanges } from "@/lib/supabase/test-iterations";
import { formatIterationTimestamp } from "@/lib/utils";
import SectionLeaf from "./components/section-leaf";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem } from "@/components/ui/combobox";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Plus, Upload } from "lucide-react";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { columns } from "@/components/table/columns";
import { Board } from "@/components/board/board";
import { TestCase } from "@/components/types";
import TestCasesComponents, { type authoringContext } from "./test-cases-components";
import SectionDialog from "./components/section-dialog";
import SectionRow from "./components/section-row";
import SectionList from "./components/section-list";
import { getSuiteReadinessIssues } from "@/lib/supabase/test-suite";
import type { suiteStatus } from "@/lib/supabase/Init";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";





type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "section" | "test-case" | "test-suite";
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

async function SectionContent({ testSuiteId, sectionSlug, hasSections, authoring }: { testSuiteId: string; sectionSlug?: string; hasSections: boolean; authoring: authoringContext }) {
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
	return <TestCasesComponents testCases={section?.testCases || []} section={section} hasSections={hasSections} authoring={authoring} />;
}

export default async function TestCasesTab({
	testSuiteId,
	testSuiteSlug,
	suiteStatus,
	sectionSlug,
}: {
	testSuiteId: string;
	testSuiteSlug: string;
	suiteStatus: suiteStatus;
	sectionSlug?: string;
}) {
	// Authoring is locked once a suite is signed off or archived (the DB enforces it too).
	const editable = suiteStatus !== "signed_off" && suiteStatus !== "archived";
	// Readiness markers only matter before testing starts.
	const showReadiness = suiteStatus === "draft" || suiteStatus === "ready";

	const [suite, activeIteration, readinessIssues] = await Promise.all([
		getTestSectionsByTestSuiteId(testSuiteId),
		getActiveIteration(testSuiteId),
		showReadiness ? getSuiteReadinessIssues(testSuiteId) : Promise.resolve([]),
	]);
	// While a round runs, edits only reach testers through the vendor's Sync.
	const iterationChanges = activeIteration && editable ? await getIterationChanges(activeIteration.id) : [];
	const authoring: authoringContext = {
		sync: activeIteration ? { iteration: { id: activeIteration.id, name: activeIteration.name }, changes: iterationChanges } : null,
		suiteId: testSuiteId,
		editable,
		sections: suite.sections.map((section) => ({ id: section.id, name: section.name })),
		readinessIssues,
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
		<>
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
								{/* <SidebarGroup className="border-b pb-4">
							<SidebarGroupLabel>Current Testing Iteration</SidebarGroupLabel>
								<SidebarMenuItem>
									{activeIteration ? (
										// Results are recorded on the iteration, in the Test Results tab.
										<Link
											href={`/testingsuite/${testSuiteSlug}/all?tab=test-results&iteration=${activeIteration.iterationNumber}`}
											className="flex flex-col px-2 rounded-md hover:bg-accent py-1"
										>
											<p className="font-bold">{activeIteration.name}</p>
											<p className="font-mono text-xs text-muted-foreground">{formatIterationTimestamp(activeIteration)}</p>
											<p className="text-xs text-primary underline underline-offset-2 pt-1">Record results in Test Results →</p>
										</Link>
									) : (
										<div className="flex flex-col px-2">
											<p className="font-bold">No active iteration</p>
											<p className="font-mono text-xs text-muted-foreground">Start one from the Test Results tab</p>
										</div>
									)}
								</SidebarMenuItem>
						</SidebarGroup> */}
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
			<SectionContent testSuiteId={testSuiteId} sectionSlug={sectionSlug} hasSections={suite.sections.length > 0} authoring={authoring} />
		</>
	)
}




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
				<CollapsibleTrigger render={
					<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
				} />
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
