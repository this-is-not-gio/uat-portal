"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { DataTable } from "@/components/table/data-table";
import { iterationParticipantColumns, type iterationParticipantRow } from "@/components/table/iteration-participant-columns";
import type { iterationParticipant, roundCoverage, testResultRow } from "@/lib/supabase/test-iterations";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
import { UserGroup } from "lucide-react";

// One row per active tester on the round's roster: their role and org, how far
// through their own copies they are, and whether they've submitted.
export default function IterationParticipantsTable({
	participants,
	testCases,
	coverage,
	iterationNumber,
	bordered,
}: {
	participants: iterationParticipant[];
	// Planned rounds only: the testers picked so far, since the roster isn't written until Start.
	coverage?: roundCoverage;
	// Every result row of the round (one per case per tester).
	testCases: testResultRow[];
	// Row click opens this tester's submitted results for the round in the Test Results tab.
	iterationNumber?: number;
	bordered?: boolean;
}) {
	const router = useRouter();
	const { testSuiteSlug } = useParams<{ testSuiteSlug: string }>();

	const rows = useMemo<iterationParticipantRow[]>(() => {
		const empty = { tested: 0, total: 0, passed: 0, failed: 0, blocked: 0 };
		const progress = new Map<string, typeof empty>();
		for (const row of testCases) {
			if (!row.includedInRun || !row.testerId) continue;
			const entry = progress.get(row.testerId) ?? { ...empty };
			entry.total += 1;
			if (row.status !== "Untested" && row.status !== "In Progress") entry.tested += 1;
			if (row.status === "Passed") entry.passed += 1;
			else if (row.status === "Failed") entry.failed += 1;
			else if (row.status === "Blocked") entry.blocked += 1;
			progress.set(row.testerId, entry);
		}
		// A planned round has no roster until Start: show who's ticked in coverage, with their role's case count.
		if (participants.length === 0 && coverage) {
			return coverage.roles.flatMap((role) =>
				role.orgs.flatMap((org) =>
					org.users
						.filter((u) => u.ticked)
						.map((u) => ({
							id: u.userId,
							name: u.fullName ?? "Unnamed tester",
							roleName: role.name,
							organizationId: org.organizationId,
							organizationName: org.name,
							organizationType: org.type,
							...empty,
							total: role.caseCount,
							submittedAt: null,
						})),
				),
			);
		}
		return participants.flatMap(({ organization, testers }) =>
			testers
				.filter((t) => t.status === "active")
				.map((t) => ({
					id: t.userId,
					name: t.fullName ?? "Unnamed tester",
					roleName: t.testRole.name,
					organizationId: organization.id,
					organizationName: organization.name,
					organizationType: organization.type,
					...(progress.get(t.userId) ?? empty),
					submittedAt: t.submittedAt,
				})),
		);
	}, [participants, testCases, coverage]);

	// DataTable's own empty state talks about test cases, so say it here instead.
	if (rows.length === 0) {
		return <div className="flex-1 min-h-64 flex flex-col items-center justify-center gap-4">
			<div className="p-3 rounded-md bg-gray-600/5 text-muted-foreground">
				<UserGroup className="size-10" />
			</div>
			<div className="flex flex-col items-center text-center">
				<p className="font-heading text-lg font-semibold">No Participants Yet</p>
				<p className="text-xs text-muted-foreground">Add section to the iteration to planning participants.</p>
			</div>
		</div>;
	}

	function openResults(row: iterationParticipantRow) {
		router.push(testResultsHref(testSuiteSlug, "all", { iteration: iterationNumber, org: row.organizationId, view: "submitted", tester: row.id }));
	}

	return <DataTable columns={iterationParticipantColumns} data={rows} onRowClick={openResults} isRowClickable={(row) => !!row.submittedAt} bordered={bordered} />;
}
