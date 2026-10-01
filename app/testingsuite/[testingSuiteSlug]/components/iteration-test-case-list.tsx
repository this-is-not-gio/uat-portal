"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardIcon, ClipboardList, Plus, UserGroup, UsersRound } from "lucide-react";
import { type filterToken } from "./search-filter-combox";
import type { testCase } from "@/lib/supabase/test-cases";
import type { iterationParticipant, testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import { DataTable } from "@/components/table/data-table";
import { createIterationTestCaseColumns, type iterationCaseRow } from "@/components/table/iteration-test-cases-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import IterationParticipantsTable from "./iteration-participants-table";
import { setCaseResultInclusion } from "@/lib/supabase/iteration-actions";
import { useIterationSelection } from "./iteration-selection-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SectionDialog, { type notIncludedSection } from "./section-dialog";
import AddParticipantDialog from "./add-participant-dialog";

function matchesFilter(testCase: testCase, filter: filterToken): boolean {
	if (filter.field === "search") {
		const query = filter.value.toLowerCase();
		return testCase.title.toLowerCase().includes(query) || (testCase.code ?? "").toLowerCase().includes(query);
	}
	const actual = filter.field === "status" ? testCase.status : testCase.roleAssignee;
	const matches = actual === filter.value;
	return filter.operator === "is" ? matches : !matches;
}

// Collapse the round's one-row-per-case-per-org results into one row per case.
function groupByCase(rows: testResultRow[], orgNames: Map<string, string>): iterationCaseRow[] {
	const byCase = new Map<string, iterationCaseRow>();
	for (const row of rows) {
		const key = row.testCaseId ?? row.id;
		const group = byCase.get(key) ?? { ...row, id: key, orgResults: [] };
		group.orgResults.push({
			resultId: row.id,
			organizationId: row.organizationId,
			organizationName: orgNames.get(row.organizationId) ?? "Unknown org",
			status: row.status,
			includedInRun: row.includedInRun,
		});
		byCase.set(key, group);
	}
	return [...byCase.values()];
}

export function IterationTestCaseList({
	testCases,
	iteration,
	selectable = false,
	locked = false,
	sectionSlug,
	roundActions,
	participants = [],
	testerCounts = {},
}: {
	testCases: testResultRow[];
	iteration?: testIteration | null;
	// Checkbox column only makes sense while picking which cases to run in a
	// section, not in the iteration-wide overview.
	selectable?: boolean;
	// Checkboxes still show which cases run, but can't change (a started round's case set is locked).
	locked?: boolean;
	sectionSlug?: string;
	// Set only while the round is planned/running: shows Add Section / Add Participant.
	roundActions?: { suiteId: string; testSuiteSlug: string; sectionsNotIncluded: notIncludedSection[] };
	// Orgs taking part in this round (Participants tab).
	participants?: iterationParticipant[];
	testerCounts?: Record<string, number>;
}) {
	const [addSectionOpen, setAddSectionOpen] = useState(false);
	const [addParticipantOpen, setAddParticipantOpen] = useState(false);
	// A started round's case set is locked (apply_iteration_sync, 0023); new orgs can still join it.
	const canAddSection = !!roundActions && iteration?.status === "not_started";

	// Filter UI is parked (see commented combobox below); matching still applies.
	const [filters] = useState<filterToken[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(testCases.filter((tc) => tc.includedInRun).map((tc) => tc.id)));
	const [inclusionError, setInclusionError] = useState<string | null>(null);
	const [tab, setTab] = useState<"test-cases" | "issues">("test-cases");
	const orgNames = useMemo(
		() => new Map(participants.map(({ organization }) => [organization.id, organization.name])),
		[participants]
	);

	const { setCount } = useIterationSelection();
	useEffect(() => {
		if (iteration && sectionSlug) {
			// One row per org, so count cases (like getSectionsByIteration) to match the sidebar.
			const selectedCases = new Set(testCases.filter((tc) => selectedIds.has(tc.id)).map((tc) => tc.testCaseId ?? tc.id));
			setCount(`${iteration.id}:${sectionSlug}`, selectedCases.size);
		}
	}, [iteration, sectionSlug, selectedIds, setCount, testCases]);

	const visibleTestCases = useMemo(() => {
		if (filters.length === 0) return testCases;
		return testCases.filter((testCase) => filters.every((filter) => matchesFilter(testCase, filter)));
	}, [testCases, filters]);

	// The round-wide "All" list shows only what will run; a section view keeps every case so
	// its checkboxes can show (and, while planned, change) what's left out.
	const caseRows = useMemo(
		() => groupByCase(sectionSlug ? visibleTestCases : visibleTestCases.filter((tc) => tc.includedInRun), orgNames),
		[visibleTestCases, orgNames, sectionSlug]
	);

	const visibleIds = useMemo(() => visibleTestCases.map((tc) => tc.id), [visibleTestCases]);
	const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
	const someSelected = visibleIds.some((id) => selectedIds.has(id));

	// Optimistic, then one set_case_inclusion call. It's all-or-nothing (e.g. unticking a case
	// that already has results rejects the whole batch), so a failure restores the previous ticks.
	function applyInclusion(ids: string[], checked: boolean) {
		if (locked || ids.length === 0) return;
		const previous = selectedIds;
		setInclusionError(null);
		setSelectedIds((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (checked) next.add(id);
				else next.delete(id);
			}
			return next;
		});
		setCaseResultInclusion({ caseResultIds: ids, included: checked }).then((result) => {
			if (result.ok) return;
			setSelectedIds(previous);
			setInclusionError(result.error);
		});
	}

	// A case's checkbox covers every org's copy of it in the round.
	function handleToggle(row: iterationCaseRow, checked: boolean) {
		applyInclusion(row.orgResults.map((result) => result.resultId), checked);
	}

	function handleToggleAll(checked: boolean) {
		applyInclusion(visibleIds, checked);
	}

	const columns = useMemo(
		() => (selectable ? createIterationTestCaseColumns({ selectedIds, onToggle: handleToggle, allSelected, someSelected, onToggleAll: handleToggleAll, disabled: locked }) : createIterationTestCaseColumns({})),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[selectable, locked, selectedIds, allSelected, someSelected]
	);

	return (
		<div className="flex-1 flex flex-col gap-3">
			{/* <SearchFilterCombobox filters={filters} onFiltersChange={setFilters} roleAssigneeValues={roleAssigneeValues} disabled /> */}
			{/* <div className="flex flex-row items-center justify-between gap-2">
				<p className="text-xs font-medium text-muted-foreground">Included Test Cases</p>
				<Badge variant="secondary" className="text-xs">
					{selectable ? `${selectedIds.size} / ${visibleTestCases.length} Selected` : `${visibleTestCases.length} Test Cases`}
				</Badge>
			</div> */}
			{/* <DataTable columns={columns} data={visibleTestCases} /> */}
			{/* A single section only needs its case table; the tabs are for the round overview. */}
			{!sectionSlug && <div className="flex flex-row items-center justify-between gap-2">
				<Tabs defaultValue="test-cases" value={tab} onValueChange={(value) => setTab(value as "test-cases" | "issues")} className="w-full">
					<TabsList>
						<TabsTrigger value="test-cases" className="flex flex-row items-center gap-2">
							<ClipboardIcon className="size-4" />
							<p className="text-xs font-medium">Test Cases</p>
						</TabsTrigger>
						<TabsTrigger value="issues" className="flex flex-row items-center gap-2">
							<UserGroup className="size-4" />
							<p className="text-xs font-medium">Participants</p>
						</TabsTrigger>
					</TabsList>
				</Tabs>
					{tab === "test-cases" ? (
						<div className="flex flex-row items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground whitespace-nowrap">
								<span className="font-medium font-mono">{caseRows.length}</span> test {caseRows.length === 1 ? "case" : "cases"} in this iteration
							</p>
							{canAddSection && caseRows.length > 0 && (
								<Button onClick={() => setAddSectionOpen(true)}>
									<Plus className="h-3.5 w-3.5" />
									<p className="text-xs">Add Section</p>
								</Button>
							)}
						</div>
					) : (
						<div className="flex flex-row items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground whitespace-nowrap">
								<span className="font-medium font-mono">{participants.length}</span> {participants.length === 1 ? "organization" : "organizations"} participating 
							</p>
							{roundActions && participants.length > 0 && (
								<Button onClick={() => setAddParticipantOpen(true)}>
									<Plus className="h-3.5 w-3.5" />
									<p className="text-xs">Add Participant</p>
								</Button>
							)}
						</div>
					)}
			</div>}
			{inclusionError && (
				<p role="alert" className="text-xs text-destructive bg-red-50 border border-red-600/30 rounded-md px-3 py-2">{inclusionError}</p>
			)}
			{/*  */}
			{ !sectionSlug && tab === "test-cases" && caseRows.length === 0 ? (
				// Rows are copied per participant, so a section can only be added once an org takes part.
				<IterationEmptyState
					icon={<ClipboardList size={45} className="text-muted-foreground" />}
					title="No sections yet"
					description={participants.length === 0
						? "Add a participant first, then add the sections this round will test."
						: `Add the sections ${iteration?.name ?? "this iteration"} will test.`}
					action={canAddSection && (participants.length === 0 ? (
						// A disabled button gets no pointer events, so the span carries the tooltip.
						<Tooltip>
							<TooltipTrigger render={<span className="inline-flex" />}>
								<Button disabled>
									<Plus className="h-3.5 w-3.5" />
									<p className="text-xs">Add Section</p>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Add a participant organization first</TooltipContent>
						</Tooltip>
					) : (
						<Button onClick={() => setAddSectionOpen(true)}>
							<Plus className="h-3.5 w-3.5" />
							<p className="text-xs">Add Section</p>
						</Button>
					))}
				/>
			) : !sectionSlug && tab !== "test-cases" && participants.length === 0 ? (
				<IterationEmptyState
					icon={<UsersRound size={45} className="text-muted-foreground" />}
					title="No participants yet"
					description="Add the organizations that will record results in this round."
					action={roundActions && (
						<Button onClick={() => setAddParticipantOpen(true)}>
							<Plus className="h-3.5 w-3.5" />
							<p className="text-xs">Add Participant</p>
						</Button>
					)}
				/>
			) : sectionSlug || tab === "test-cases" ? (
				<DataTable
					columns={columns}
					data={caseRows}
					renderRowDetail={(row) => <TestCaseSheet testCase={row} onChangeTestCase={() => {}} />}
				/>
			) : (
				<IterationParticipantsTable participants={participants} testCases={testCases} testerCounts={testerCounts} iterationId={roundActions ? iteration?.id : undefined} />
			)}
			{roundActions && iteration && (
				<>
					{canAddSection && <SectionDialog
						suiteId={roundActions.suiteId}
						testSuiteSlug={roundActions.testSuiteSlug}
						open={addSectionOpen}
						onOpenChange={setAddSectionOpen}
						sectionsNotIncluded={roundActions.sectionsNotIncluded}
						iterationId={iteration.id}
					/>}
					<AddParticipantDialog iteration={iteration} open={addParticipantOpen} onOpenChange={setAddParticipantOpen} />
				</>
			)}
		</div>
	);
}

// Matches the "No test cases yet" empty state used across the suite page.
function IterationEmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
	return (
		<div className="flex-1 flex items-center justify-center h-full ">
			<div className="flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					{icon}
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">{title}</p>
					<p className="text-xs text-muted-foreground">{description}</p>
				</div>
				{action}
			</div>
		</div>
	);
}
