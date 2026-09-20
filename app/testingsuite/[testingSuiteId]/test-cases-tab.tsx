import { CollapsibleContent, CollapsibleTrigger, Collapsible } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { getSection, getTestSectionsByTestSuiteId } from "@/lib/supabase/test-sections";
import { ChevronRight, File, Folder, ClipboardIcon, ClipboardXIcon, ClipboardCheck, SquareKanban, Sheet } from "lucide-react";
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

const mockTestCases: TestCase[] = [
	{
		id: "TC-001",
		title: "Submit new company registration application",
		description: "Verify a user can submit a new company registration application with valid data.",
		section: "Application Intake",
		priority: "high",
		roleAssignee: "Action-Officer",
		status: "Passed",
		order: 0,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Fill out the registration form with valid data and submit.",
				expectedResults: [{ id: "res-1", result: "Application is created with status 'Pending'." }],
			},
		],
	},
	{
		id: "TC-002",
		title: "Reject application with missing required fields",
		description: "Verify the system blocks submission when required fields are missing.",
		section: "Application Intake",
		priority: "medium",
		roleAssignee: "Action-Officer",
		status: "Failed",
		order: 1,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Leave a required field blank and attempt to submit.",
				expectedResults: [{ id: "res-1", result: "Form shows a validation error and blocks submission." }],
			},
		],
	},
	{
		id: "TC-003",
		title: "Route application for SEC endorsement",
		description: "Verify an approved application is routed to the correct SEC endorsement queue.",
		section: "SEC Endorsement",
		priority: "high",
		roleAssignee: "Supervisor",
		status: "Untested",
		order: 2,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Approve the application at the intake stage.",
				expectedResults: [{ id: "res-1", result: "Application status changes to 'Pending SEC Endorsement'." }],
			},
		],
	},
	{
		id: "TC-004",
		title: "Issue certificate after final approval",
		description: "Verify a certificate is generated once all approval stages are completed.",
		section: "Certificate Issuance",
		priority: "high",
		roleAssignee: "Deputy-Commissioner",
		status: "Untested",
		order: 3,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Complete all prior approval stages for the application.",
				expectedResults: [{ id: "res-1", result: "Certificate is generated and made available for download." }],
			},
		],
	},
	{
		id: "TC-005",
		title: "Validate required document uploads",
		description: "Verify the system requires all mandatory supporting documents before an application can proceed.",
		section: "Application Intake",
		priority: "medium",
		roleAssignee: "Action-Officer",
		status: "Passed",
		order: 4,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Attempt to submit an application without uploading a mandatory document.",
				expectedResults: [{ id: "res-1", result: "System blocks submission and lists the missing document." }],
			},
		],
	},
	{
		id: "TC-006",
		title: "Flag duplicate company registration",
		description: "Verify the system detects and flags a registration attempt for an already-registered company.",
		section: "Application Intake",
		priority: "high",
		roleAssignee: "Action-Officer",
		status: "Failed",
		order: 5,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Submit a registration using details that match an existing company record.",
				expectedResults: [{ id: "res-1", result: "System flags the application as a possible duplicate for review." }],
			},
		],
	},
	{
		id: "TC-007",
		title: "Escalate stalled application past SLA",
		description: "Verify an application pending SEC endorsement beyond the SLA window is escalated automatically.",
		section: "SEC Endorsement",
		priority: "medium",
		roleAssignee: "Supervisor",
		status: "Untested",
		order: 6,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Leave an application in 'Pending SEC Endorsement' status past the configured SLA.",
				expectedResults: [{ id: "res-1", result: "Application is escalated and a notification is sent to the supervisor." }],
			},
		],
	},
	{
		id: "TC-008",
		title: "Reject endorsement with missing SEC remarks",
		description: "Verify SEC endorsement cannot be rejected without providing a reason.",
		section: "SEC Endorsement",
		priority: "medium",
		roleAssignee: "Supervisor",
		status: "Failed",
		order: 7,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Attempt to reject an application's SEC endorsement without entering remarks.",
				expectedResults: [{ id: "res-1", result: "System blocks the rejection and prompts for remarks." }],
			},
		],
	},
	{
		id: "TC-009",
		title: "Route endorsed application to Division Manager",
		description: "Verify an application approved at SEC endorsement is routed to the correct Division Manager queue.",
		section: "SEC Endorsement",
		priority: "high",
		roleAssignee: "Division-Manager",
		status: "Passed",
		order: 8,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Approve an application's SEC endorsement.",
				expectedResults: [{ id: "res-1", result: "Application appears in the assigned Division Manager's queue." }],
			},
		],
	},
	{
		id: "TC-010",
		title: "Allow resubmission after rejection",
		description: "Verify a rejected application can be corrected and resubmitted without creating a duplicate record.",
		section: "Application Intake",
		priority: "medium",
		roleAssignee: "Action-Officer",
		status: "Untested",
		order: 9,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Correct a rejected application's flagged fields and resubmit.",
				expectedResults: [{ id: "res-1", result: "Application updates in place and re-enters the intake queue." }],
			},
		],
	},
	{
		id: "TC-011",
		title: "Deputy Commissioner final sign-off",
		description: "Verify the Deputy Commissioner can grant final sign-off once all prior approvals are complete.",
		section: "Certificate Issuance",
		priority: "high",
		roleAssignee: "Deputy-Commissioner",
		status: "Passed",
		order: 10,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Review a fully-approved application and grant final sign-off.",
				expectedResults: [{ id: "res-1", result: "Application status changes to 'Approved' and certificate generation is triggered." }],
			},
		],
	},
	{
		id: "TC-012",
		title: "Prevent certificate reissue for revoked application",
		description: "Verify a revoked application cannot have its certificate reissued.",
		section: "Certificate Issuance",
		priority: "low",
		roleAssignee: "Deputy-Commissioner",
		status: "Failed",
		order: 11,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Attempt to reissue a certificate for an application marked 'Revoked'.",
				expectedResults: [{ id: "res-1", result: "System blocks the action and displays a revoked-status error." }],
			},
		],
	},
	{
		id: "TC-013",
		title: "Insurance Commissioner audit review",
		description: "Verify the Insurance Commissioner can view an audit trail of all approval actions on an application.",
		section: "Certificate Issuance",
		priority: "low",
		roleAssignee: "Insurance Commissioner",
		status: "Untested",
		order: 12,
		stepsToExecute: [
			{
				id: "step-1",
				step: "Open the audit trail for a fully-processed application.",
				expectedResults: [{ id: "res-1", result: "All approval steps, actors, and timestamps are displayed in order." }],
			},
		],
	},
];





type TreeNode = {
	name: string;
	id: string;
};
type TreeItem = TreeNode | [TreeNode, ...TreeItem[]];

export default async function TestCasesTab({ testSuiteId, sectionId }: { testSuiteId: string; sectionId?: string }) {
	const suite = await getTestSectionsByTestSuiteId(testSuiteId);
	let section;
	if (sectionId){
		section = await getSection(sectionId);
	}
	const data: TreeItem[] = [
		[
			{ name: suite.name, id: suite.id },
			...suite.sections.map(section => ({ name: section.name, id: section.id }))
		]
	]

	return (
		<>
			<div className="w-100 shrink-0 border-r flex flex-col px-2">
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Testing Suite</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{
									data.map((item, index) => (
										<Tree key={index} item={item} />
									))
								}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</div>
			<TestCasesComponents testCases={section?.testCases || []} section={section} />
		</>
	)
}




function Tree({ item }: { item: TreeItem }) {
	const [{ name, id }, ...items] = Array.isArray(item) ? item : [item]

	if (!items.length) {
		return (
			<SectionLeaf name={name} id={id} />
		)
	}

	return (
		<SidebarMenuItem>
			<Collapsible
				className="w-full"
				defaultOpen={name === "SEC Endorsement"}
			>
				<CollapsibleTrigger render={
					<SidebarMenuButton className="group/collapsible">
						<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
						<Folder />
						{name}
					</SidebarMenuButton>
				} />
				<CollapsibleContent>
					<SidebarMenuSub>
						{
							items.map((item, index) => (
								<Tree key={index} item={item} />
							))
						}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	)
}
