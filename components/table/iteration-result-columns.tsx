"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
// Type-only import: test-iterations.ts uses the server Supabase client.
import type { testResultRow } from "@/lib/supabase/test-iterations"

const columnHelper = createColumnHelper<DataTableFeatures, testResultRow>()

// Read-only listing of every test case an iteration snapshotted, across all
// its sections — no status/result column here, that's the Test Results
// tab's job (test-result-columns.tsx); this table just shows what's included.
export const iterationResultColumns = columnHelper.columns([
	columnHelper.accessor("sectionName", {
		header: "Section",
		cell: (info) => <p className="text-xs text-muted-foreground">{info.getValue() ?? "—"}</p>,
	}),
	columnHelper.display({
		id: "testCase",
		header: "Test Case",
		cell: (info) => (
			<div>
				<p className="text-sm">{info.row.original.title}</p>
				<p className="text-xs text-muted-foreground">{info.row.original.code}</p>
			</div>
		),
	}),
])
