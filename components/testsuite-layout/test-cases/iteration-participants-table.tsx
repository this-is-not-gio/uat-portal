"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { DataTable } from "@/components/table/data-table";
import { iterationParticipantColumns, type iterationParticipantRow } from "@/components/table/iteration-participant-columns";
import type { iterationParticipant, testResultRow } from "@/lib/supabase/test-iterations";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";

// One row per org taking part in the round: who they are, how many testers
// they have, how far through their included cases they are, and whether
// they've submitted.
export default function IterationParticipantsTable({
	participants,
	testCases,
	testerCounts,
	iterationId,
	iterationNumber,
	bordered,
}: {
	participants: iterationParticipant[];
	// Every result row of the round (one per case per org).
	testCases: testResultRow[];
	testerCounts: Record<string, number>;
	// Set only while the round is planned/running: enables Withdraw organization.
	iterationId?: string;
	// Row click opens this org's results for the round in the Test Results tab.
	iterationNumber?: number;
	bordered?: boolean;
}) {
	const router = useRouter();
	const { testSuiteSlug } = useParams<{ testSuiteSlug: string }>();

	const rows = useMemo<iterationParticipantRow[]>(() => {
		const empty = { tested: 0, total: 0, passed: 0, failed: 0, blocked: 0 };
		const progress = new Map<string, typeof empty>();
		for (const row of testCases) {
			if (!row.includedInRun) continue;
			const entry = progress.get(row.organizationId) ?? { ...empty };
			entry.total += 1;
			if (row.status !== "Untested" && row.status !== "In Progress") entry.tested += 1;
			if (row.status === "Passed") entry.passed += 1;
			else if (row.status === "Failed") entry.failed += 1;
			else if (row.status === "Blocked") entry.blocked += 1;
			progress.set(row.organizationId, entry);
		}
		return participants.map(({ organization, submittedAt }) => ({
			id: organization.id,
			name: organization.name,
			typeLabel: ORG_TYPE_LABELS[organization.type],
			testerCount: testerCounts[organization.id] ?? 0,
			...(progress.get(organization.id) ?? empty),
			submittedAt,
			iterationId,
		}));
	}, [participants, testCases, testerCounts, iterationId]);

	// DataTable's own empty state talks about test cases, so say it here instead.
	if (rows.length === 0) {
		return <p className="text-xs text-muted-foreground py-6 text-center">No organizations are taking part in this round yet.</p>;
	}

	function openResults(row: iterationParticipantRow) {
		router.push(testResultsHref(testSuiteSlug, "all", { iteration: iterationNumber, org: row.id }));
	}

	return <DataTable columns={iterationParticipantColumns} data={rows} onRowClick={openResults} bordered={bordered} />;
}
