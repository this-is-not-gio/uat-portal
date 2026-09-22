import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SectionLeaf from "./components/section-leaf";
import { CircleCheck, CircleX, Clipboard, FileIcon, FileUpIcon, FolderIcon, SkipForward } from "lucide-react";
import { Button, } from "@/components/ui/button";



type TreeNode = {
	name: string;
	id: string;
	slug: string;
	itemtype?: "section" | "test-case" | "test-suite";
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

const sampleTreeData: TreeItem[] = [
	[
		{ name: "SEC Endorsement", id: "suite-1", slug: "all", itemtype: "test-suite" },
		[
			{ name: "Application Intake", id: "section-1", slug: "application-intake", itemtype: "section" },
			{ name: "Submit new company registration application", id: "tc-1", slug: "tc-001", itemtype: "test-case" },
			{ name: "Reject application with missing required fields", id: "tc-2", slug: "tc-002", itemtype: "test-case" },
			{ name: "Validate required document uploads", id: "tc-5", slug: "tc-005", itemtype: "test-case" },
			{ name: "Flag duplicate company registration", id: "tc-6", slug: "tc-006", itemtype: "test-case" },
			{ name: "Allow resubmission after rejection", id: "tc-10", slug: "tc-010", itemtype: "test-case" },
		],
		[
			{ name: "SEC Endorsement", id: "section-2", slug: "sec-endorsement", itemtype: "section" },
			{ name: "Route application for SEC endorsement", id: "tc-3", slug: "tc-003", itemtype: "test-case" },
			{ name: "Escalate stalled application past SLA", id: "tc-7", slug: "tc-007", itemtype: "test-case" },
			{ name: "Reject endorsement with missing SEC remarks", id: "tc-8", slug: "tc-008", itemtype: "test-case" },
			{ name: "Route endorsed application to Division Manager", id: "tc-9", slug: "tc-009", itemtype: "test-case" },
		],
		[
			{ name: "Certificate Issuance", id: "section-3", slug: "certificate-issuance", itemtype: "section" },
			{ name: "Issue certificate after final approval", id: "tc-4", slug: "tc-004", itemtype: "test-case" },
			{ name: "Deputy Commissioner final sign-off", id: "tc-11", slug: "tc-011", itemtype: "test-case" },
			{ name: "Prevent certificate reissue for revoked application", id: "tc-12", slug: "tc-012", itemtype: "test-case" },
			{ name: "Insurance Commissioner audit review", id: "tc-13", slug: "tc-013", itemtype: "test-case" },
		],
	],
];

function Tree({ item, testSuiteSlug }: { item: TreeItem; testSuiteSlug: string }) {
	const [{ name, id, slug, itemtype }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		return (
			// <SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
			<SidebarMenuButton name={name} id={id} >
				<FileIcon />
				{name}
			</SidebarMenuButton>
		)
	}


	return (
		<SidebarMenuItem>
			<Collapsible
				className="w-full"
				defaultOpen={name === "SEC Endorsement"}
			>
				<CollapsibleTrigger render={
					// <SectionLeaf name={name} id={id} slug={slug} itemtype={itemtype} testSuiteSlug={testSuiteSlug} />
					<SidebarMenuButton name={name} id={id} >
						<FolderIcon />
						{name}
					</SidebarMenuButton>
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

export default function TestResultTab() {
	return (
		<>
			<div className="w-100 shrink-0 border-r">
				<SidebarContent>
					<SidebarContent>
						<SidebarGroup className="border-b p-4 pt-2">
							<SidebarGroupLabel>Test Results</SidebarGroupLabel>
							<SidebarGroupContent>
								<Select>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a test result" />
									</SelectTrigger>
									<SelectContent alignItemWithTrigger={false}>
										<SelectItem value="test-result-1">Test Result 1</SelectItem>
										<SelectItem value="test-result-2">Test Result 2</SelectItem>
										<SelectItem value="test-result-3">Test Result 3</SelectItem>
									</SelectContent>
								</Select>
							</SidebarGroupContent>
						</SidebarGroup>
						<SidebarGroup className="px-4 py-2">
							<SidebarGroupLabel>Test Suite</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{
										sampleTreeData.map((item, index) => (
											<Tree key={index} item={item} testSuiteSlug="ic-licensing-project" />
										))
									}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</SidebarContent>
			</div>
			<div className="flex-1 p-4 flex flex-col gap-4">
				<div className="flex flex-row items-center justify-between gap-4">
					<div className="">
						<p className="text-xs text-muted-foreground">Test Iteration</p>
						<p className="font-semibold">User Acceptance Test 01</p>
					</div>
					<Button className="" size="lg">
						<FileUpIcon/>
						<p className="text-sm">Export Test Results</p>
					</Button>
				</div>
				<div className="flex flex-row items-center justify-between gap-4">
					<div className="flex flex-row items-center gap-2 border p-4 rounded-md w-full bg-gray-50/10">
						<div className="bg-gray-50/50 size-12 border rounded-md flex flex-row items-center justify-center">
							<Clipboard />
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Total Test Cases Executed</p>
							<p className="text-xl flex flex-row items-center gap-2 font-bold">100 Test Cases</p>
						</div>
					</div>
					<div className="flex flex-row items-center gap-2 border p-4 rounded-md w-full bg-gray-50/">
						<div className="bg-green-50/50 size-12 border border-green-800 rounded-md flex flex-row items-center justify-center">
							<CircleCheck className="text-green-800" />
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Passed Test Cases</p>
							<p className="text-xl flex flex-row items-center gap-2 font-bold">100 Test Cases</p>
						</div>
					</div>
					<div className="flex flex-row items-center gap-2 border p-4 rounded-md w-full bg-gray-50/10">
						<div className="bg-red-50/50 size-12 border border-red-800 rounded-md flex flex-row items-center justify-center">
							<CircleX className="text-red-800" />
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Failed Test Cases</p>
							<p className="text-xl flex flex-row items-center gap-2 font-bold">100 Test Cases</p>
						</div>
					</div>
					<div className="flex flex-row items-center gap-2 border p-4 rounded-md w-full bg-gray-50/10">
						<div className="bg-gray-50/50 size-12 border rounded-md flex flex-row items-center justify-center">
							<SkipForward />
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Skipped Test Cases </p>
							<p className="text-xl flex flex-row items-center gap-2 font-bold">100 Test Cases</p>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}
