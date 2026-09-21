
import { CollapsibleContent, CollapsibleTrigger, Collapsible } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getAllTestCasesBySuiteId, getSectionBySlug, getTestSectionsByTestSuiteId } from "@/lib/supabase/test-sections";
import SectionLeaf from "./components/section-leaf";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem } from "@/components/ui/combobox";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { columns } from "@/components/table/columns";
import { Board } from "@/components/board/board";
import { TestCase } from "@/components/types";
import TestCasesComponents from "./test-cases-components";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";





type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "section" | "test-case" | "test-suite";
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

async function SectionContent({ testSuiteId, sectionSlug }: { testSuiteId: string; sectionSlug?: string }) {
	let section;
	if (sectionSlug === "all") {
		section = await getAllTestCasesBySuiteId(testSuiteId);
	} else if (sectionSlug) {
		section = await getSectionBySlug(testSuiteId, sectionSlug);
	}
	return <TestCasesComponents testCases={section?.testCases || []} section={section} />;
}

export default async function TestCasesTab({
	testSuiteId,
	testSuiteSlug,
	sectionSlug,
}: {
	testSuiteId: string;
	testSuiteSlug: string;
	sectionSlug?: string;
}) {

	const suite = await getTestSectionsByTestSuiteId(testSuiteId);
	const data: TreeItem[] = [
		[
			{ name: suite.name, id: suite.id, slug: "all", itemtype: "test-suite" as const },
			...suite.sections.map(section => ({ name: section.name, id: section.id, slug: section.slug, itemtype: "section" as const }))
		]
	];

	return (
		<>
			<div className="w-100 shrink-0 border-r flex flex-col px-2">
				<Suspense fallback={sideBarSkeleton()}>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Testing Suite</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{
										data.map((item, index) => (
											<Tree key={index} item={item} testSuiteSlug={testSuiteSlug} />
										))
									}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Suspense>
			</div>
			<SectionContent testSuiteId={testSuiteId} sectionSlug={sectionSlug} />
		</>
	)
}




function Tree({ item, testSuiteSlug }: { item: TreeItem; testSuiteSlug: string }) {
	const [{ name, id, slug, itemtype }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		return (
			<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
		)
	}

	return (
		<SidebarMenuItem>
			<Collapsible
				className="w-full"
				defaultOpen={name === "SEC Endorsement"}
			>
				<CollapsibleTrigger render={
					<SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
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
