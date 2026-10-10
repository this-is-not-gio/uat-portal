"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { ClipboardCheck, Info, TriangleAlert, Waypoints } from "lucide-react"
import { type DataTableFeatures } from "./data-table-features"
import type { importCase, importIssue } from "@/lib/import/parse-test-cases"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card"

// One staged case in the import review. `id` is the case's first spreadsheet
// row (DataTable needs a string id); `warnings` are the issues on its rows;
// `isNewSection` is true when the suite has no section with that name yet.
export type importReviewRow = importCase & { id: string; warnings: importIssue[]; isNewSection: boolean }

const columnHelper = createColumnHelper<DataTableFeatures, importReviewRow>()

export function getImportReviewColumns() {
	return columnHelper.columns([
		// TODO(Gio): define the columns (Row, Section, Title, Steps, Issues).
		// Use <IssueBadge issues={info.row.original.warnings} /> for the Issues cell.
		columnHelper.display({
			header: "Test Case",
			cell: (info) => <div className="flex flex-col gap-1">
				<p className="font-semibold">{info.row.original.title}</p>
				<div className="flex flex-row items-center gap-1.5">
					<p className="text-xs text-muted-foreground font-mono">{info.row.original.sectionName}</p>
					{info.row.original.isNewSection && (
						<span className="rounded-md bg-blue-600/5 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">New</span>
					)}
				</div>
			</div>,
			footer: (info) => info.column.id,
		}),
		columnHelper.accessor("preconditions", {
			header: "Preconditions",
			cell: (info) => (
				info.getValue()?.length === 0 ? (
					<div className="flex flex-row items-center gap-2 justify-between">
						<p className="font-mono text-xs text-muted-foreground">—</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1 rounded-md p-1 bg-blue-600/5 w-fit">
									<Info size={15} className="text-blue-800" />
								</div>
							} />
							<HoverCardContent className="w-fit p-4 flex flex-col gap-3">
								<div className="flex flex-row items-start gap-2">
									<div className="bg-blue-600/5 rounded-md p-2 w-fit">
										<Info className="text-blue-800 size-5" />
									</div>
									<div className="">
										<p className="font-semibold text-sm">Notice</p>
										<p className="text-xs">This problem may affect the test execution.</p>
									</div>
								</div>
								<div className="">
									<p className="text-xs">Problems:</p>
									<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
										<li>No preconditions defined for this test case</li>
									</ul>
								</div>
							</HoverCardContent>
						</HoverCard>
					</div>
				) : (
					<div className=" flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
						<ClipboardCheck size={15} className="text-gray-800" />
						<div className="flex flex-row items-center gap-0.5">
							<p className="font-mono text-xs text-gray-800">{info.getValue()?.length}</p>
						</div>
					</div>
				)
			)
		}),
		columnHelper.accessor("steps", {
			header: "Steps to Execute",
			cell: (info) => {
				const steps = info.getValue() ?? [];
				const stepsMissingExpected = steps.filter((step) => (step.expectedResults?.length ?? 0) === 0);
				return steps.length === 0 ? (
					<div className="flex flex-row items-center gap-2 justify-between">
						<p className="font-mono text-xs text-muted-foreground">—</p>
						<HoverCard>
							<HoverCardTrigger render={
								<div className="flex flex-row items-center gap-1.5 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
									<TriangleAlert size={15} className="text-amber-800" />
								</div>
							} />
							<HoverCardContent className="w-fit p-4 flex flex-col gap-3">
								<div className="flex flex-row items-start gap-2">
									<div className="bg-amber-600/5 rounded-md p-2 w-fit">
										<TriangleAlert className="text-amber-800 size-5" />
									</div>
									<div className="">
										<p className="font-semibold text-sm">Warning</p>
										<p className="text-xs">This problem may affect the test execution.</p>
									</div>
								</div>
								<div className="">
									<p className="text-xs">Problems:</p>
									<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
										<li>No steps defined for this test case</li>
									</ul>
								</div>
							</HoverCardContent>
						</HoverCard>
					</div>
				) : (
					<div className="flex flex-row items-center gap-2">
						<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
							<Waypoints size={15} className="text-gray-800" />
							<div className="flex flex-row items-center gap-0.5">
								<p className="font-mono text-xs text-gray-800">{steps.length}</p>
								<p className="text-xs text-gray-800 font-semibold">Steps</p>
							</div>
						</div>
						{stepsMissingExpected.length > 0 && (
							<HoverCard>
								<HoverCardTrigger render={
									<div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
										<TriangleAlert size={15} className="text-amber-800" />
										<p className="font-mono text-xs text-amber-800">{stepsMissingExpected.length}</p>
									</div>
								} />
								<HoverCardContent className="w-fit max-w-sm p-4 flex flex-col gap-3">
									<div className="flex flex-row items-start gap-2">
										<div className="bg-amber-600/5 rounded-md p-2 w-fit">
											<TriangleAlert className="text-amber-800 size-5" />
										</div>
										<div className="">
											<p className="font-semibold text-sm">Warning</p>
											<p className="text-xs">These problems may affect the test execution.</p>
										</div>
									</div>
									<div className="">
										<p className="text-xs">{stepsMissingExpected.length} of {steps.length} step{steps.length === 1 ? "" : "s"} missing an expected result:</p>
										<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
											{stepsMissingExpected.map((step, i) => (
												<li key={i}>{step.step}</li>
											))}
										</ul>
									</div>
								</HoverCardContent>
							</HoverCard>
						)}
					</div>
				)
			}
		}),
		columnHelper.accessor("roleAssignee", {
			header: "Assigned Role",
			cell: (info) => info.row.original.unmatchedRole ?
				<div className="flex flex-row items-center gap-1" title="Map this name to a catalog role above">
					<p className="text-xs text-destructive">&ldquo;{info.row.original.unmatchedRole}&rdquo; · Not mapped</p>
				</div>
				: info.getValue() ?
				 <div className="flex flex-row items-center gap-1">
					<p className="text-xs">{info.getValue()}</p>
				 </div>
				: <div className="flex flex-row items-center gap-1">
					<p className="text-xs text-muted-foreground">No Role Assigned</p>
				</div>,
		}),
		columnHelper.display({
			id: "issues",
			header: "",
			// `warnings` already holds every issue from the case's rows (built in import-review.tsx).
			cell: (info) => <MissingList issues={info.row.original.warnings} />,
		})
	])

}

// Short label for each kind of warning, keyed by the column it's about.
function missingLabel(column: importIssue["column"], count: number): string {
	switch (column) {
		case "EXPECTED RESULT":
			return `${count} ${count === 1 ? "step" : "steps"} missing expected result`
		case "ASSIGNED ROLE":
			return "No role assignee"
		default:
			return count === 1 ? "1 issue" : `${count} issues`
	}
}

// What's missing on this case, one amber chip per kind of warning. Hovering a
// chip shows the spreadsheet rows it came from.
export function MissingList({ issues }: { issues: importIssue[] }) {
	if (!issues.length) return null

	const groups = new Map<importIssue["column"], number[]>()
	for (const issue of issues) {
		groups.set(issue.column, [...(groups.get(issue.column) ?? []), issue.row])
	}

	return (
		<div className="flex flex-col items-start gap-1">
			{/* {[...groups].map(([column, rows]) => (
				<div
					key={column ?? "case"}
					title={`Row ${rows.join(", ")}`}
					className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit"
				>
					<TriangleAlert size={13} className="text-amber-800 shrink-0" />
					<p className="text-xs text-amber-800">{missingLabel(column, rows.length)}</p>
				</div>
			))} */}
			<HoverCard>
				<HoverCardTrigger render={
					<div className="flex flex-row items-center gap-1.5 rounded-md py-1 px-1.5 bg-amber-600/5 w-fit">
						<TriangleAlert size={15} className="text-amber-800" />
						{
							issues.length > 1 ? (
								<p className="font-mono text-xs text-amber-800">{issues.length}</p>
							) : null
						}
					</div>
				} />
				<HoverCardContent className="w-fit max-w-sm p-4 flex flex-col gap-3">
					<div className="flex flex-row items-start gap-2">
						<div className="bg-amber-600/5 rounded-md p-2 w-fit">
							<TriangleAlert className="text-amber-800 size-5" />
						</div>
						<div className="">
							<p className="font-semibold text-sm">Warning</p>
							<p className="text-xs">These problems may affect the test execution.</p>
						</div>
					</div>
					<ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
						{issues.map((issue, i) => (
							<li key={i}>{issue.message}</li>
						))}
					</ul>
				</HoverCardContent>
			</HoverCard>
		</div>
	)
}
