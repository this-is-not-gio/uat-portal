import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SectionLeaf from "./components/section-leaf";
import { CircleCheck, CircleX, Clipboard, FileIcon, FileUpIcon, FolderIcon, SkipForward } from "lucide-react";
import { Button, } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { testResultColumns, type testResultRow } from "@/components/table/test-result-columns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";



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

type testResultsOptions = {
	name: string;
	timeCompleted: string
}

const testResultsOptionsData: testResultsOptions[] = [
	{ name: "User Acceptance Test 01", timeCompleted: "2026-09-18 14:32" },
	{ name: "User Acceptance Test 02", timeCompleted: "2026-09-20 09:15" },
	{ name: "User Acceptance Test 03", timeCompleted: "2026-09-22 17:48" },
];

// A completed test result only ever holds a final verdict — Passed or
// Failed. In-Progress/Untested test cases haven't reached a verdict yet, so
// they don't belong in a result run and are excluded here.
const mockExecutor = { id: "c1a9f2e0-3b4d-4f2a-9e5a-1d6b7c8f9a01", full_name: "Maria Santos", role: "Internal" };

// Shape is expected to grow once this is wired to real execution data —
// kept minimal for now, see components/table/test-result-columns.tsx.
const sampleTestResultRows: testResultRow[] = [
	{
		id: "tc-1", code: "tc-001", title: "Submit new company registration application",
		status: "Passed", roleAssignee: "Kora-Admin", executor: mockExecutor, completedAt: "2026-09-18 14:02",
		preconditions: [
			{ id: "pc-1", condition: "User is logged in as a Kora-Admin" },
			{ id: "pc-2", condition: "No existing registration exists for the company" },
		],
		stepsToExecute: [
			{
				id: "step-1", step: "Fill out company registration form with valid data",
				expectedResults: [{ id: "er-1", result: "Form accepts all required fields without validation errors" }],
				status: "Passed",
				remarks: [{ id: "rm-1", remark: "All fields accepted valid input as expected.", author: mockExecutor, created_at: "2026-09-18T14:00:12.000Z" }],
			},
			{
				id: "step-2", step: "Submit the form",
				expectedResults: [{ id: "er-2", result: "Application is created and routed for review" }],
				status: "Passed",
				remarks: [{ id: "rm-2", remark: "Application appeared in the review queue immediately after submit.", author: mockExecutor, created_at: "2026-09-18T14:02:47.000Z" }],
			},
		],
	},
	{
		id: "tc-2", code: "tc-002", title: "Reject application with missing required fields",
		status: "Failed", roleAssignee: "Action-Officer", executor: mockExecutor, completedAt: "2026-09-18 14:11",
		preconditions: [
			{ id: "pc-3", condition: "User is logged in as an Action-Officer" },
		],
		stepsToExecute: [
			{
				id: "step-3", step: "Leave a required field blank and submit the form",
				expectedResults: [{ id: "er-3", result: "Form blocks submission and shows a validation message" }],
				status: "Failed",
				remarks: [{ id: "rm-3", remark: "Validation message did not appear on submit — form allowed submission with the required field blank.", author: mockExecutor, created_at: "2026-09-18T14:10:05.000Z" }],
			},
			{
				id: "step-4", step: "Verify the incomplete application was not created",
				expectedResults: [{ id: "er-4", result: "No application record exists in the queue" }],
				status: "Failed",
				remarks: [{ id: "rm-4", remark: "An incomplete application record was created despite the missing field.", author: mockExecutor, created_at: "2026-09-18T14:11:00.000Z" }],
			},
		],
	},
	{
		id: "tc-3", code: "tc-003", title: "Route application for SEC endorsement",
		status: "Passed", roleAssignee: "Supervisor", executor: mockExecutor, completedAt: "2026-09-19 09:24",
		preconditions: [
			{ id: "pc-4", condition: "Application has already passed Application Intake" },
		],
		stepsToExecute: [
			{
				id: "step-5", step: "Approve application at Supervisor level",
				expectedResults: [{ id: "er-5", result: "Application routes to SEC for endorsement" }],
				status: "Passed",
				remarks: [{ id: "rm-5", remark: "Application moved to the SEC endorsement queue as expected.", author: mockExecutor, created_at: "2026-09-19T09:24:11.000Z" }],
			},
		],
	},
	{
		id: "tc-4", code: "tc-004", title: "Reject endorsement with missing SEC remarks",
		status: "Failed", roleAssignee: "Deputy-Commissioner", executor: mockExecutor, completedAt: "2026-09-19 10:03",
		preconditions: [
			{ id: "pc-5", condition: "Application is pending SEC endorsement" },
		],
		stepsToExecute: [
			{
				id: "step-6", step: "Attempt to endorse the application without entering SEC remarks",
				expectedResults: [{ id: "er-6", result: "Endorsement is blocked until SEC remarks are entered" }],
				status: "Failed",
				remarks: [{ id: "rm-6", remark: "Endorsement went through with remarks left blank — should have been blocked.", author: mockExecutor, created_at: "2026-09-19T10:03:29.000Z" }],
			},
		],
	},
	{
		id: "tc-5", code: "tc-005", title: "Validate required document uploads",
		status: "Passed", roleAssignee: "Kora-Admin", executor: mockExecutor, completedAt: "2026-09-19 11:40",
		preconditions: [
			{ id: "pc-6", condition: "User is at the document upload step of the application" },
		],
		stepsToExecute: [
			{
				id: "step-7", step: "Upload a document in an unsupported file format",
				expectedResults: [{ id: "er-7", result: "Upload is rejected with a supported-format message" }],
				status: "Passed",
				remarks: [{ id: "rm-7", remark: "Unsupported file was rejected as expected.", author: mockExecutor, created_at: "2026-09-19T11:38:02.000Z" }],
			},
			{
				id: "step-8", step: "Upload a valid document",
				expectedResults: [{ id: "er-8", result: "Document is attached to the application" }],
				status: "Passed",
				remarks: [{ id: "rm-8", remark: "Document attached and visible in the application record.", author: mockExecutor, created_at: "2026-09-19T11:40:19.000Z" }],
			},
		],
	},
	{
		id: "tc-6", code: "tc-006", title: "Flag duplicate company registration",
		status: "Failed", roleAssignee: "Kora-Admin", executor: mockExecutor, completedAt: "2026-09-19 13:05",
		preconditions: [
			{ id: "pc-7", condition: "A company with the same registration number already exists" },
		],
		stepsToExecute: [
			{
				id: "step-9", step: "Submit a registration using an already-registered company number",
				expectedResults: [{ id: "er-9", result: "Submission is blocked with a duplicate-company warning" }],
				status: "Failed",
				remarks: [{ id: "rm-9", remark: "No duplicate warning shown — second registration was accepted.", author: mockExecutor, created_at: "2026-09-19T13:05:44.000Z" }],
			},
			{
				id: "step-10", step: "Confirm only one registration record exists for the company",
				expectedResults: [{ id: "er-10", result: "Only the original registration record exists" }],
				status: "Blocked",
				remarks: [{ id: "rm-10", remark: "Skipped verification — prior step already failed, duplicate record was created.", author: mockExecutor, created_at: "2026-09-19T13:06:10.000Z" }],
			},
		],
	},
	{
		id: "tc-7", code: "tc-007", title: "Escalate stalled application past SLA",
		status: "Passed", roleAssignee: "Supervisor", executor: mockExecutor, completedAt: "2026-09-20 08:52",
		preconditions: [
			{ id: "pc-8", condition: "Application has been pending review past the configured SLA window" },
		],
		stepsToExecute: [
			{
				id: "step-11", step: "Advance the system clock past the SLA window for a pending application",
				expectedResults: [{ id: "er-11", result: "Application is flagged as overdue" }],
				status: "Passed",
				remarks: [{ id: "rm-11", remark: "Application was correctly flagged as overdue once SLA elapsed.", author: mockExecutor, created_at: "2026-09-20T08:50:00.000Z" }],
			},
			{
				id: "step-12", step: "Verify the overdue application is escalated to a Supervisor",
				expectedResults: [{ id: "er-12", result: "Supervisor receives an escalation notification" }],
				status: "Passed",
				remarks: [{ id: "rm-12", remark: "Escalation notification received by Supervisor as expected.", author: mockExecutor, created_at: "2026-09-20T08:52:31.000Z" }],
			},
			{
				id: "step-13", step: "Check the escalation email content for accuracy",
				expectedResults: [{ id: "er-13", result: "Email lists the correct application ID and overdue duration" }],
				status: "Skipped",
				remarks: [{ id: "rm-13", remark: "Skipped — email delivery verification is out of scope for this environment.", author: mockExecutor, created_at: "2026-09-20T08:52:40.000Z" }],
			},
		],
	},
	{
		id: "tc-8", code: "tc-008", title: "Prevent certificate reissue for revoked application",
		status: "Failed", roleAssignee: "Deputy-Commissioner", executor: mockExecutor, completedAt: "2026-09-20 15:18",
		preconditions: [
			{ id: "pc-9", condition: "Application's certificate has already been revoked" },
		],
		stepsToExecute: [
			{
				id: "step-14", step: "Attempt to reissue a certificate for a revoked application",
				expectedResults: [{ id: "er-14", result: "Reissue request is blocked with a revoked-status message" }],
				status: "Failed",
				remarks: [{ id: "rm-14", remark: "System allowed the reissue request to go through despite the revoked status.", author: mockExecutor, created_at: "2026-09-20T15:18:52.000Z" }],
			},
		],
	},
];

export default function TestResultTab() {
	return (
		<>
			<div className="w-100 shrink-0 border-r">
				<SidebarContent>
					<SidebarContent>
						<SidebarGroup className="border-b p-4 pt-2">
							<SidebarGroupLabel className="">Test Results</SidebarGroupLabel>
							<SidebarGroupContent>
								<Select>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a test result" />
									</SelectTrigger>
									<SelectContent alignItemWithTrigger={false}>
										{
											testResultsOptionsData.map((option, index) => (
												<SelectItem key={index} value={option.name}>
													<div className="flex flex-col">
														<p className="text-sm">{option.name}</p>
														<p className="text-xs text-muted-foreground font-mono">{option.timeCompleted}</p>
													</div>
												</SelectItem>
											))
										}
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
					<div className="flex flex-row items-center gap-2">
						<Avatar>
							<AvatarFallback>{initials(mockExecutor.full_name)}</AvatarFallback>
						</Avatar>
						<div>
							<p className="text-xs text-muted-foreground">Test Result</p>
							<p className="font-semibold">User Acceptance Test 01</p>
						</div>
					</div>
					<Button className="" size="lg">
						<FileUpIcon/>
						<p className="text-sm">Export Test Results</p>
					</Button>
				</div>
				<div className="flex flex-row items-center justify-between gap-2">
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
				<div className="min-h-0 flex-1">
					<DataTable columns={testResultColumns} data={sampleTestResultRows} />
				</div>
			</div>
		</>
	)
}
