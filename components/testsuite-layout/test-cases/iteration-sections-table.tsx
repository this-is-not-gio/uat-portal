"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, ClipboardPen, User } from "lucide-react";
import { DataTable } from "@/components/table/data-table";
import { createIterationTestCaseColumns, type iterationCaseRow } from "@/components/table/iteration-test-cases-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { iterationParticipant, roundCoverage, testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import AddParticipantsDialog from "./add-participants-dialog";
import IterationParticipantsTable from "./iteration-participants-table";
import { testCasesHref } from "./href";

// The round's included test cases, one card per section: the section's name and how many of its
// cases will run, who tests it, then those cases in a table. A participant card sits on top.
export default function IterationSectionsTable({ caseRows, participants = [], coverage, testerResults = [], iteration, manage, columns: columnsOverride }: {
	// One row per case (see groupByCase), already limited to the cases ticked to run.
	caseRows: iterationCaseRow[];
	// Who tests the round: the roster once started, else the testers ticked in coverage.
	participants?: iterationParticipant[];
	coverage?: roundCoverage;
	// Every tester's own copies, for the participant table's progress.
	testerResults?: testResultRow[];
	iteration?: testIteration | null;
	// Set while the round is planned: enables the participant and section Manage buttons.
	manage?: { testSuiteSlug: string };
	// The section page passes its own columns (inclusion checkboxes); the round page uses the plain ones.
	columns?: ReturnType<typeof createIterationTestCaseColumns>;
}) {
	const defaultColumns = useMemo(() => createIterationTestCaseColumns({ showFlags: false }), []);
	const columns = columnsOverride ?? defaultColumns;
	const [participantsOpen, setParticipantsOpen] = useState(false);

	// Everyone on the round with their role; a section's participants are those holding a role its cases need.
	const testers = useMemo(() => {
		if (participants.length > 0) {
			return participants.flatMap(({ organization, testers }) =>
				testers.filter((t) => t.status === "active").map((t) => ({ id: t.userId, name: t.fullName ?? "Unnamed tester", role: t.testRole.name, org: organization.name })));
		}
		return (coverage?.roles ?? []).flatMap((role) =>
			role.orgs.flatMap((org) => org.users.filter((u) => u.ticked).map((u) => ({ id: u.userId, name: u.fullName ?? "Unnamed tester", role: role.name, org: org.name }))));
	}, [participants, coverage]);

	const sections = useMemo(() => {
		const bySection = new Map<string, { slug: string | null; name: string; rows: iterationCaseRow[]; roles: Set<string> }>();
		for (const row of caseRows) {
			const key = row.sectionSlug ?? row.sectionName ?? "";
			const entry = bySection.get(key) ?? { slug: row.sectionSlug ?? null, name: row.sectionName ?? "No section", rows: [], roles: new Set<string>() };
			entry.rows.push(row);
			if (row.roleAssignee) entry.roles.add(row.roleAssignee);
			bySection.set(key, entry);
		}
		return [...bySection.entries()].map(([key, section]) => ({ key, ...section }));
	}, [caseRows]);

	// Empty round: nothing planned yet.
	if (sections.length === 0) {
		return <div className="flex-1 min-h-64 flex flex-col items-center justify-center gap-4">
			<div className="p-3 rounded-md bg-gray-600/5 text-muted-foreground">
				<ClipboardList className="size-10" />
			</div>
			<div className="flex flex-col items-center text-center">
				<p className="font-heading text-lg font-semibold">No Test Cases</p>
				<p className="text-xs text-muted-foreground">Add test cases to this iteration to start planning.</p>
			</div>
		</div>;
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="border rounded-md">
				<div className="p-4 bg-gray-200/10 flex flex-row items-center justify-between gap-2 border-b">
					<div className="flex flex-row items-center gap-2">
						<User className="size-5" />
						<p className="text-xs font-medium">Iteration Participant</p>
						<p className="text-xs text-muted-foreground">{testers.length} {testers.length === 1 ? "tester" : "testers"}</p>
					</div>
					{manage && coverage && (
						<Button variant="outline" size="sm" className="text-xs" onClick={() => setParticipantsOpen(true)}><ClipboardPen className="size-4" /> Manage Participant</Button>
					)}
				</div>
				<IterationParticipantsTable participants={participants} testCases={testerResults} coverage={coverage} iterationNumber={iteration?.iterationNumber} bordered={false} />
			</div>
			<p className="font-medium text-xs">Test Sections</p>
			{sections.map((section) => {
				const people = testers.filter((t) => section.roles.has(t.role));
				return (
					<div key={section.key} className="border rounded-md">
						<div className="p-4 bg-gray-200/10 flex flex-row items-center justify-between gap-2 border-b">
							<div className="flex flex-row items-center gap-2">
								<ClipboardList className="size-5" />
								<p className="text-xs font-medium">{section.name}</p>
								<p className="text-xs text-muted-foreground">Included test cases: {section.rows.length}</p>
							</div>
							{manage && iteration && section.slug && (
								<Button variant="outline" size="sm" className="text-xs" nativeButton={false} render={<Link href={testCasesHref(manage.testSuiteSlug, iteration.slug, section.slug)} />}><ClipboardPen className="size-4" /> Manage Section</Button>
							)}
						</div>
						<div className="px-4 py-2 border-b flex flex-row flex-wrap items-center gap-1.5">
							<p className="text-xs text-muted-foreground">Participants:</p>
							{people.length === 0
								? <p className="text-xs text-muted-foreground">None yet</p>
								: people.map((t) => <Badge key={`${t.id}-${t.role}`} variant="secondary" className="text-xs" title={`${t.org} · ${t.role}`}>{t.name}</Badge>)}
						</div>
						<DataTable columns={columns} data={section.rows} renderRowDetail={(row) => <TestCaseSheet testCase={row} onChangeTestCase={() => { }} />} bordered={false} />
					</div>
				);
			})}
			{manage && iteration && coverage && (
				<AddParticipantsDialog iterationId={iteration.id} coverage={coverage} open={participantsOpen} onOpenChange={setParticipantsOpen} />
			)}
		</div>
	);
}
