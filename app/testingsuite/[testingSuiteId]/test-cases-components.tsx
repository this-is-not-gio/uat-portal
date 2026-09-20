"use client"

import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem } from "@/components/ui/combobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SquareKanban, ClipboardIcon, ClipboardXIcon, ClipboardCheck } from "lucide-react";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { columns } from "@/components/table/columns";
import { Board } from "@/components/board/board";
import { useState } from "react";
import { TestCase } from "@/components/types";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { TestSection } from "@/lib/supabase/test-sections";
import { testCase } from "@/lib/supabase/test-cases";

const frameworks = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

export default function TestCasesComponents({ testCases, section }: { testCases: testCase[], section?: TestSection; }) {
	const [viewMode, setViewMode] = useState<"table" | "board">("table");
	const PassedTestCases = testCases.filter((testCase) => testCase.status === "Passed").length || 0;
	const FailedTestCases = testCases.filter((testCase) => testCase.status === "Failed").length || 0;
	const InProgressTestCases = testCases.filter((testCase) => testCase.status === "In Progress").length || 0;

	return (
		<>
			<div className="flex-1 p-4 flex flex-col gap-4 overflow-y-hidden">
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
						{
							section?.testCases.length === 0 ? null : (
								<Badge variant="secondary" className="text-xs">{section?.testCases.length} Test Cases</Badge>
							)
						}
					</div>
					<div className="flex flex-row items-center gap-2">
						{
							PassedTestCases === 0 ? null : (
							<div className="py-1 px-2 border border-green-700 bg-green-200  rounded-md flex flex-row items-center gap-1">
								<p className="text-xs text-green-950 font-semibold">{PassedTestCases} Passed Test Case</p>
								<ClipboardCheck data-icon="inline-start" size={15} className="text-green-950" />
							</div>
							)
						}
						{
							FailedTestCases === 0 ? null : (
							<div className="py-1 px-2 border border-red-700 bg-red-200 rounded-md flex flex-row items-center gap-1">
								<p className="text-xs text-red-950 font-semibold">{FailedTestCases} Failed Test Case</p>
								<ClipboardXIcon data-icon="inline-start" size={15} className="text-red-950" />
							</div>
							)
						}
					</div>
				</div>
				<div className="flex flex-row items-center justify-between gap-2">
					<Combobox items={frameworks}>
						<ComboboxInput placeholder="Select a framework..." className="w-full" disabled	/>
						<ComboboxContent>
							<ComboboxList>
								{frameworks.map((framework) => (
									<ComboboxItem key={framework} value={framework}>
										{framework}
									</ComboboxItem>
								))}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
					<Tabs defaultValue="table" className="min-h-0 flex flex-row" onValueChange={(value) => setViewMode(value as "table" | "board")}>
						<TabsList className="">
							<TabsTrigger value="table" className="w-1/2">
								<Sheet className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="board" className="w-1/2">
								<SquareKanban className="h-4 w-4" />
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<Tabs value={viewMode} className="min-h-0 flex-1">
					<TabsContent value="table" className="min-h-0 flex-1">
						<DataTable
							columns={columns}
							data={testCases}
							renderRowDetail={(testCase) => <TestCaseSheet testCase={testCase} />}
						/>
					</TabsContent>
					<TabsContent value="board" className="min-h-0 flex-1">
						{/* <Board testCases={testCasesState} setTestCases={setTestCases} /> */}
					</TabsContent>
				</Tabs>
			</div>
		</>
	)
}
