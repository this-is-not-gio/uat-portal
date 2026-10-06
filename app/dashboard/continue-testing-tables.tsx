"use client"
import { useRouter } from "next/navigation"
import { DataTable } from "@/components/table/data-table"
import { DataTableFeatures } from "@/components/table/data-table-features"
import type { SidebarSuite } from "@/lib/supabase/Init"
import { createColumnHelper } from "@tanstack/react-table"

// One row per suite whose open round the user is in and hasn't submitted yet.
export type continueTestingRow = {
	id: string
	slug: string
	title: string
	round: string
	remaining: number
}

const columnHelper = createColumnHelper<DataTableFeatures, continueTestingRow>()

const continueTestingColumns = columnHelper.columns([
	columnHelper.accessor("title", {
		header: "Test Suite",
		cell: (info) => info.getValue(),
	}),
	columnHelper.accessor("round", {
		header: "Round",
		meta: {
			className: "hidden lg:table-cell",
		},
		cell: (info) => info.getValue(),
	}),
	columnHelper.accessor("remaining", {
		header: "Remaining",
		cell: (info) => info.getValue(),
	}),
])

export default function ContinueTestingTables({ testingSuites }: { testingSuites: SidebarSuite[] }) {
	const router = useRouter()

	const rows: continueTestingRow[] = testingSuites.flatMap((suite) =>
		suite.openRound && suite.mine.inOpenRound && !suite.mine.submittedAt
			? [{
				id: suite.id,
				slug: suite.slug,
				title: suite.title,
				round: `Round ${suite.openRound.number}: ${suite.openRound.name}`,
				remaining: suite.mine.remaining,
			}]
			: []
	)

	// DataTable's own empty state talks about test cases, so say it here instead.
	if (rows.length === 0) {
		return <p className="text-xs text-muted-foreground py-6 text-center">Nothing to test right now.</p>
	}

	return (
		<DataTable
			columns={continueTestingColumns}
			data={rows}
			onRowClick={(row) => router.push(`/testingsuite/${row.slug}/all?tab=test-cases`)}
			bordered={false}
		/>
	)
}
