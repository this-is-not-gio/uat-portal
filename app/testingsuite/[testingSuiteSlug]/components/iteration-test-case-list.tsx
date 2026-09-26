"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchFilterCombobox, type filterToken } from "./search-filter-combox";
import type { testCase } from "@/lib/supabase/test-cases";
import { testIteration, type testResultRow } from "@/lib/supabase/test-iterations";
import { DataTable } from "@/components/table/data-table";
import { createIterationTestCaseColumns } from "@/components/table/iteration-test-cases-columns";
import { setCaseResultInclusion } from "@/lib/supabase/iteration-actions";
import { useIterationSelection } from "./iteration-selection-context";

function matchesFilter(testCase: testCase, filter: filterToken): boolean {
	if (filter.field === "search") {
		const query = filter.value.toLowerCase();
		return testCase.title.toLowerCase().includes(query) || (testCase.code ?? "").toLowerCase().includes(query);
	}
	const actual = filter.field === "status" ? testCase.status : testCase.roleAssignee;
	const matches = actual === filter.value;
	return filter.operator === "is" ? matches : !matches;
}

export function IterationTestCaseList({
	testCases,
	iteration,
	selectable = false,
	sectionSlug,
}: {
	testCases: testResultRow[];
	iteration?: testIteration | null;
	// Checkbox column only makes sense while picking which cases to run in a
	// section, not in the iteration-wide overview.
	selectable?: boolean;
	sectionSlug?: string;
}) {

	const [filters, setFilters] = useState<filterToken[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(testCases.filter((tc) => tc.includedInRun).map((tc) => tc.id)));

	const roleAssigneeValues = useMemo(
		() => [...new Set(testCases.map((testCase) => testCase.roleAssignee).filter((value): value is string => !!value))],
		[testCases]
	);

	const {setCount} = useIterationSelection();
	useEffect(()=>{
		if(iteration && sectionSlug) {
			setCount(`${iteration.id}:${sectionSlug}`, selectedIds.size);
		}
	}, [iteration, sectionSlug, selectedIds, setCount]);

	const visibleTestCases = useMemo(() => {
		if (filters.length === 0) return testCases;
		return testCases.filter((testCase) => filters.every((filter) => matchesFilter(testCase, filter)));
	}, [testCases, filters]);

	const visibleIds = useMemo(() => visibleTestCases.map((tc) => tc.id), [visibleTestCases]);
	const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
	const someSelected = visibleIds.some((id) => selectedIds.has(id));

	function handleToggle(id: string, checked: boolean) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});

		setCaseResultInclusion({ caseResultId: id, included: checked }).then((result) => {
			if (result.ok) return;
			console.error(`Failed to set inclusion of ${id} to ${checked}:`, result.error);
			setSelectedIds((current) => {
				const next = new Set(current);
				if (checked) next.delete(id);
				else next.add(id);
				return next;
			});
		})
	}

	function handleToggleAll(checked: boolean) {
		setSelectedIds((current) => {
			const next = new Set(current);
			for (const id of visibleIds) {
				if (checked) next.add(id);
				else next.delete(id);
			}
			return next;
		});
		Promise.all(visibleIds.map((id) => setCaseResultInclusion({ caseResultId: id, included: checked }))).then((results) => {
			const failed = results.filter((result) => !result.ok);
			if (failed.length === 0) return;
			console.error(`Failed to set inclusion of ${failed.length} test cases to ${checked}:`, failed.map((r) => r.error));
		});
	}

	const columns = useMemo(
		() => (selectable ? createIterationTestCaseColumns({ selectedIds, onToggle: handleToggle, allSelected, someSelected, onToggleAll: handleToggleAll }) : createIterationTestCaseColumns({})),
		[selectable, selectedIds]
	);

	return (
		<div className="flex flex-col gap-3">
			<SearchFilterCombobox filters={filters} onFiltersChange={setFilters} roleAssigneeValues={roleAssigneeValues} disabled />
			<div className="flex flex-row items-center justify-between gap-2">
				<p className="text-xs font-medium text-muted-foreground">Included Test Cases</p>
				<Badge variant="secondary" className="text-xs">
					{selectable ? `${selectedIds.size} / ${visibleTestCases.length} Selected` : `${visibleTestCases.length} Test Cases`}
				</Badge>
			</div>
			<DataTable columns={columns} data={visibleTestCases} />
		</div>
	);
}
