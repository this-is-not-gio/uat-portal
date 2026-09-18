"use client";

import { useState } from "react";
import { Board } from "@/components/board/board";
import { DataTable } from "@/components/table/data-table";
import { uatTicketColumns } from "@/components/table/uat-ticket-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SquareKanban, Sheet } from "lucide-react";
import type { TestCase } from "@/components/types";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"



export function EpicWorkspace({
	initialTestCases,
}: {
	initialTestCases: TestCase[];
}) {
	const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases);
	const [viewMode, setViewMode] = useState<"table" | "board">("table");
	const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
	const frameworks = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"]
	

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex flex-row items-center justify-between gap-2">
				<Combobox items={frameworks}>
					<ComboboxInput placeholder="Select a framework..."  className="w-full" />
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
				<Tabs defaultValue="table" onValueChange={(value) => setViewMode(value as "table" | "board")} className="min-h-0 flex flex-row">
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
			<Tabs value={viewMode} className="min-h-0 flex-1 w-full flex flex-col">
				<TabsContent value="board" className="flex min-h-0 flex-col">
					<Board testCases={testCases} setTestCases={setTestCases} />
				</TabsContent>
				<TabsContent value="table" className="flex min-h-0 flex-col">
					<DataTable
						columns={uatTicketColumns}
						data={testCases}
						renderRowDetail={(testCase) => <TestCaseSheet testCase={testCase} />}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
