"use client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SquareKanban, ClipboardIcon, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import TestCaseEditor from "./components/test-case-editor";
import ConfirmDialog from "./components/confirm-dialog";
import { deleteTestCase } from "@/lib/supabase/authoring-actions";
import type { readinessIssue } from "@/lib/supabase/test-suite";
import type { iterationChange } from "@/lib/supabase/test-iterations";
import SyncBanner from "./components/sync-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { columns } from "@/components/table/columns";
import { Board } from "@/components/board/board";
import { Suspense, useState } from "react";
import { TestCase } from "@/components/types";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { testSection } from "@/lib/supabase/test-sections";
import { testCase } from "@/lib/supabase/test-cases";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchFilterCombobox, type filterToken } from "./components/search-filter-combox";
import { TestingSuites } from "@/lib/supabase/Init";




export type authoringContext = {
	suiteId: string;
	// false once the suite is signed off or archived.
	editable: boolean;
	sections: { id: string; name: string }[];
	// Empty unless the suite is Draft/Ready.
	readinessIssues: readinessIssue[];
	// Set while an iteration is running: live edits not yet synced into it.
	sync: { iteration: { id: string; name: string }; changes: iterationChange[] } | null;
};

// Row marker relative to the running round: not in it yet, edited-but-untested, or edited-after-testing.
function syncMarkerFor(sync: authoringContext["sync"], testCaseId: string): "not_in_round" | "changed" | "outdated" | undefined {
	const change = sync?.changes.find((c) => c.testCaseId === testCaseId);
	if (!change) return undefined;
	if (change.change === "added") return "not_in_round";
	if (change.change === "changed") return change.hasResults ? "outdated" : "changed";
	return undefined;
}

export default function TestCasesComponents({ testCases, section, hasSections, authoring }: { testCases: testCase[], section?: testSection; hasSections: boolean; authoring: authoringContext }) {
	// Live definitions only change through the editor, which refreshes the route, so read props directly.
	const testCaseData = testCases.map((tc) => ({
		...tc,
		readinessIssues: authoring.readinessIssues.filter((issue) => issue.testCaseId === tc.id).map((issue) => issue.issue),
		syncMarker: syncMarkerFor(authoring.sync, tc.id),
	}));
	// "All Sections" carries the suite id; default new cases to the open section, else the first one.
	const defaultSectionId = authoring.sections.some((s) => s.id === section?.id) ? section?.id : authoring.sections[0]?.id;
	const newTestCaseTrigger = (label: string) => (
		<Button>
			<Plus className="h-4 w-4" />
			<p className="text-xs">{label}</p>
		</Button>
	);
	const [viewMode, setViewMode] = useState<"table" | "board">("table");
	const [filters, setFilters] = useState<filterToken[]>([]);

	function matchFilter(tc: testCase, filter: filterToken[]): boolean {
		return filter.every((f) => {
			if (f.field === "search") return tc.title.toLowerCase().includes(f.value.toLowerCase());
			const actual = f.field === "status" ? tc.status : tc.roleAssignee;
			const isEqual = actual === f.value;
			return f.operator === "is" ? isEqual : !isEqual;
		})
	}

	const roleAssigneeValues = Array.from(new Set(testCaseData.map((tc) => tc.roleAssignee).filter((ra): ra is string => ra !== undefined)));
	const filteredTestCases = testCaseData.filter((tc) => matchFilter(tc, filters));




	if (testCases.length === 0 && section?.name === "All Sections" && !hasSections) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					<FolderOpen size={45} className="text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">Nothing to show yet</p>
					<p className="text-xs text-muted-foreground">Create a section and add test cases to start testing.</p>
				</div>
			</div>
		)
	} else if (testCases.length === 0 && section?.name === "All Sections" && hasSections) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					<ClipboardIcon size={45} className="text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">No test cases yet</p>
					<p className="text-xs text-muted-foreground">Add test cases to your sections to see them here.</p>
				</div>
			</div>
		)
	} else if (testCases.length === 0 && section?.name !== "All Sections") {
		return (
			<div className="flex flex-col p-4 w-full gap-4">
				<div className="">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">Test Suite</p>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">SEC Endorsement</p>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">SEC Endorsement</p>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="bg-gray-50/30 px-4 py-3 border rounded-md flex flex-row items-center justify-between">
					<div className="flex flex-row items-center gap-2">
						<ClipboardIcon size={16} />
						<p className="flex flex-row items-center gap-2 font-medium">{section?.name}</p>
						<Badge variant="secondary" className="text-xs">{section?.testCases.length} Test Cases</Badge>
					</div>
				</div>
				<SearchFilterCombobox
						filters={filters}
						onFiltersChange={setFilters}
						roleAssigneeValues={roleAssigneeValues}
						disabled
				/>
				<div className="flex-1 flex items-center justify-center">
					<div className="flex flex-col items-center justify-center gap-5 py-12">
						<div className="flex flex-col items-center justify-center text-center gap-5">
							<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
								<FolderOpen size={45} className="text-muted-foreground" />
							</div>
							<div className="flex flex-col items-center justify-center gap-1">
								<p className="font-semibold text-muted-foreground text-lg">No test cases yet</p>
								<p className="text-xs text-muted-foreground">Test cases will appear here once they&apos;re added to {section?.name} section.</p>
							</div>
						</div>
						{authoring.editable && (
							<TestCaseEditor sections={authoring.sections} defaultSectionId={defaultSectionId} trigger={newTestCaseTrigger("Add a test case")} />
						)}
					</div>
				</div>
			</div>
		)
	}


	return (

		<ScrollArea className="flex-1 shrink-0 border-r flex flex-col px-2">
			<div className="flex-1 p-4 flex flex-col gap-4">
				<div className="">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">Test Suite</p>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">SEC Endorsement</p>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">SEC Endorsement</p>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				{authoring.sync && authoring.editable && (
					<SyncBanner
						// Remount when the set of changes differs so the default selection follows it.
						key={authoring.sync.changes.map((c) => `${c.change}${c.testCaseResultId ?? c.testCaseId}`).join("|")}
						iteration={authoring.sync.iteration}
						changes={authoring.sync.changes}
					/>
				)}
				<Suspense fallback={<Skeleton className="h-12 w-full" />}>
					<div className="bg-gray-50/30 px-4 py-3 border rounded-md flex flex-row items-center justify-between">
						<div className="flex flex-row items-center gap-2">
							<ClipboardIcon size={16} />
							<p className="flex flex-row items-center gap-2 font-medium">{section?.name}</p>
							{
								section?.testCases.length === 0 ? null : (
									<Badge variant="secondary" className="text-xs">{section?.testCases.length} Test Cases</Badge>
								)
							}
						</div>
						{authoring.editable && (
							<TestCaseEditor sections={authoring.sections} defaultSectionId={defaultSectionId} trigger={newTestCaseTrigger("New test case")} />
						)}
					</div>
				</Suspense>
				<div className="flex flex-row items-center justify-between gap-2">
					<SearchFilterCombobox
						filters={filters}
						onFiltersChange={setFilters}
						roleAssigneeValues={roleAssigneeValues}
					/>
					{/* <Tabs defaultValue="table" className="min-h-0 flex flex-row" onValueChange={(value) => setViewMode(value as "table" | "board")}>
						<TabsList className="">
							<TabsTrigger value="table" className="w-1/2">
								<Sheet className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="board" className="w-1/2">
								<SquareKanban className="h-4 w-4" />
							</TabsTrigger>
						</TabsList>
					</Tabs> */}
				</div>
				<Suspense fallback={<Skeleton className="h-70 w-full" />}>
					<Tabs value={viewMode} className="min-h-0 flex-1">
						<TabsContent value="table" className="min-h-0 flex-1">
							<DataTable
								columns={columns}
								data={filteredTestCases}
								renderRowDetail={(testCase) =>
									<TestCaseSheet testCase={testCase}
										onChangeTestCase={() => {}}
										headerActions={authoring.editable && (
											<>
												<TestCaseEditor
													sections={authoring.sections}
													testCase={testCase}
													trigger={<Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
												/>
												<ConfirmDialog
													title={`Delete ${testCase.code ?? "this test case"}?`}
													description="Rounds that already copied it keep their results."
													confirmLabel="Delete test case"
													onConfirm={() => deleteTestCase({ testCaseId: testCase.id })}
													trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>}
												/>
											</>
										)}
									/>}
							/>
						</TabsContent>
						<TabsContent value="board" className="min-h-0 flex-1">
							{/* <Board testCases={testCasesState} setTestCases={setTestCases} /> */}
						</TabsContent >
					</Tabs >
				</Suspense >
			</div >
		</ScrollArea >
	)
}

