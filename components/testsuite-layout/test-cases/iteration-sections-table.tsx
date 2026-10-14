"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/table/data-table";
import { iterationSectionColumns, type iterationSectionRow } from "@/components/table/iteration-section-columns";
import type { testResultRow } from "@/lib/supabase/test-iterations";
import { ClipboardList } from "lucide-react";

// One row per section in the round: how many of its cases are ticked to run and which test
// roles those cases need.
export default function IterationSectionsTable({
	testCases,
	bordered,
}: {
	// Every result row of the round (one per case per tester).
	testCases: testResultRow[];
	bordered?: boolean;
}) {
	const rows = useMemo<iterationSectionRow[]>(() => {
		const sections = new Map<string, { row: iterationSectionRow; cases: Set<string>; selected: Set<string>; roles: Set<string> }>();
		for (const tc of testCases) {
			const key = tc.sectionSlug ?? tc.sectionName ?? "";
			const entry = sections.get(key) ?? {
				row: { id: key, name: tc.sectionName ?? "No section", selected: 0, total: 0, roles: [] },
				cases: new Set<string>(),
				selected: new Set<string>(),
				roles: new Set<string>(),
			};
			// Testers each hold a copy of a case, so count by the live case.
			const caseId = tc.testCaseId ?? tc.id;
			entry.cases.add(caseId);
			if (tc.includedInRun) {
				entry.selected.add(caseId);
				if (tc.roleAssignee) entry.roles.add(tc.roleAssignee);
			}
			sections.set(key, entry);
		}
		return [...sections.values()].map(({ row, cases, selected, roles }) => ({
			...row,
			selected: selected.size,
			total: cases.size,
			roles: [...roles].sort(),
		}));
	}, [testCases]);

	// DataTable's own empty state talks about test cases, so say it here instead.
	if (rows.length === 0) {
		return <div className="flex-1 min-h-64 flex flex-col items-center justify-center gap-4">
			<div className="p-3 rounded-md bg-gray-600/5 text-muted-foreground">
				<ClipboardList className="size-10" />
			</div>
			<div className="flex flex-col items-center text-center">
				<p className="font-heading text-lg font-semibold">No Participants Yet</p>
				<p className="text-xs text-muted-foreground">Add section to the iteration to planning participants.</p>
			</div>
		</div>;
	}

	return <DataTable columns={iterationSectionColumns} data={rows} bordered={bordered} notEnd={true} />;
}
