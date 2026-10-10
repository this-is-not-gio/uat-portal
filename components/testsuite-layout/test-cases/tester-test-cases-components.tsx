"use client";

import { TestCasesSidebarTrigger } from "./test-cases-sidebar";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { CircleCheck, CircleX, ClipboardIcon, Eye, Info, Search, TriangleAlert, File, ListCheck, TestTubesIcon, Icon, LucideIcon, GitBranch, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/table/data-table";
import { type DataTableFeatures } from "@/components/table/data-table-features";
import { TestStatusMapping } from "@/components/table/columns";
import { ChangeFlagsCell, RemarkCountCell, ResultSummaryCell } from "@/components/table/test-result-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import type { testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import type { testRole } from "@/lib/supabase/organizations";
import { isRemovedFromRound } from "@/lib/supabase/case-states";
import { cn } from "@/lib/utils";
import { SubmitDialog, WithdrawButton, type untestedCase } from "@/components/testsuite-layout/shared/submission-bar";
import { Progress } from "@/components/ui/progress";
import { useCurrentUser } from "@/components/current-user-provider";

type statusFilter = "all" | "untested" | "failed" | "changed";
const ALL_ROLES = "__all__";

// Removed rows (0036) are out of the run: never "untested", never counted.
const isUntested = (row: testResultRow) => !isRemovedFromRound(row) && (row.status === "Untested" || row.status === "In Progress");
// Vendor sync touched it this round (unsynced template edits never show here).
const isChanged = (row: testResultRow) => row.syncKind !== null;

const STATUS_FILTERS: { value: statusFilter; label: string; icon: LucideIcon; match: (row: testResultRow) => boolean }[] = [
	{ value: "all", label: "All", match: () => true, icon: ListCheck },
	{ value: "untested", label: "Untested", match: isUntested, icon: TestTubesIcon },
	// { value: "failed", label: "Failed", match: (row) => row.status === "Failed" , icon: CircleX},
	{ value: "changed", label: "Changed", match: isChanged, icon: GitBranch },
];

function changeLabel(row: testResultRow): string | null {
	if (row.syncKind === "added") return "Added mid-round.";
	if (row.syncKind === "updated") return "Updated mid-round.";
	if (row.syncKind === "force_reset") return `Results reset by the Development Team${row.archives[0]?.reason ? `: ${row.archives[0].reason}` : "."}`;
	return null;
}

const formatDateTime = (iso: string) => format(parseISO(iso), "MMM d yyyy, h:mm a");

const columnHelper = createColumnHelper<DataTableFeatures, testResultRow>();

const testerColumns = columnHelper.columns([
	// columnHelper.accessor("code", {
	// 	header: "Code",
	// 	cell: (info) => <p className="text-xs font-mono text-muted-foreground">{info.getValue() ?? "—"}</p>,
	// }),
	// What the vendor did to the case this round (Updated / Reset), only once they approved it.
	columnHelper.display({
		id: "changes",
		header: "",
		cell: (info) => <div className="flex items-center justify-center w-fit">
			<ChangeFlagsCell row={info.row.original} />
		</div>,
	}),
	columnHelper.display({
		header: "Test Case",
		cell: (info) => {
			return (
				<div className="flex flex-col gap-1">
					<p className="text-xs">{info.row.original.title}</p>
					<p className="text-xs font-mono text-muted-foreground">
						{info.row.original.code ?? "—"}
						{/* Mobile hides the Status column, so the status rides on the code line. */}
						{info.row.original.status !== "Untested" && <span className="md:hidden">{` · ${info.row.original.status}`}</span>}
					</p>
				</div>
			);
		},
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Account Role",
		meta: { className: "hidden lg:table-cell" },
		cell: (info) => <p className="text-xs text-muted-foreground">{info.getValue() ?? "—"}</p>,
	}),
	columnHelper.display({
		header: "Remarks",
		meta: { className: "hidden lg:table-cell" },
		cell: (info) => <RemarkCountCell row={info.row.original} />,
	}),
	columnHelper.display({
		header: "Test Summary",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => <ResultSummaryCell row={info.row.original} />,
	}),
	columnHelper.accessor("status", {
		header: "",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => {
			const value = info.getValue();
			if (value === "Untested") return null;
			const status = TestStatusMapping[value as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const color = value === "Passed" ? "bg-green-100 text-green-800" : value === "In Progress" ? "bg-blue-100 text-blue-800" : "";
			return (
				<div className="flex items-end justify-end">
					<Badge className={`text-xs ${color}`} variant={status?.variant || "outline"}>
						<Icon data-icon="inline-start" size={15} />
						{value}
					</Badge>
				</div>
			);
		},
	}),
]);

export default function TesterTestCasesComponents({
	suiteName,
	iteration,
	sectionName,
	organizationName,
	isOwnLens,
	results,
	canExecute,
	canRemark,
	submittedAt,
	canWithdraw,
	submit,
}: {
	suiteName: string;
	iteration: testIteration;
	sectionName: string;
	// The lens org (whose rows these are).
	organizationName: string | null;
	isOwnLens: boolean;
	results: testResultRow[];
	// Round running, suite in testing, own org, not submitted: the sheet opens in execute mode.
	canExecute: boolean;
	// Remarks stay open after submitting and after the round ends (0020).
	canRemark: boolean;
	// When the lens org submitted its results this round, if it has.
	submittedAt: string | null;
	// Own org submitted and the round is still in progress: the notice carries Withdraw.
	canWithdraw: boolean;
	// Set while the own org can still submit this round: the header shows Submit Result.
	submit: { organizationName: string; untestedCases: untestedCase[] } | null;
}) {
	const router = useRouter();
	const [rows, setRows] = useState<testResultRow[]>(results);
	const [statusFilter, setStatusFilter] = useState<statusFilter>("all");
	// On their own org's rows, testers start on their test role's cases (matched by catalog
	// role ID); "All roles" shows the rest. `role` is a catalog role ID or ALL_ROLES.
	const testRole = useCurrentUser()?.testRole;
	const [role, setRole] = useState<string>(
		() => (isOwnLens && testRole && results.some((row) => row.testRoleId === testRole.id) ? testRole.id : ALL_ROLES)
	);
	const [search, setSearch] = useState("");

	const roles = useMemo(
		() => [...new Map(rows.filter((row) => row.testRoleId).map((row) => [row.testRoleId!, row.roleAssignee ?? ""])).entries()]
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		[rows]
	);
	const roleLabel = (r: testRole) => (r.id === testRole?.id ? `${r.name} (my role)` : r.name);
	const inRun = rows.filter((row) => !isRemovedFromRound(row));
	const tested = inRun.filter((row) => !isUntested(row)).length;
	const passed = inRun.filter((row) => row.status === "Passed").length;
	const failed = inRun.filter((row) => row.status === "Failed").length;

	const query = search.trim().toLowerCase();
	const activeFilter = STATUS_FILTERS.find((f) => f.value === statusFilter) ?? STATUS_FILTERS[0];
	const visibleRows = rows
		.filter(activeFilter.match)
		.filter((row) => role === ALL_ROLES || row.testRoleId === role)
		.filter((row) => !query || row.title.toLowerCase().includes(query) || (row.code ?? "").toLowerCase().includes(query));

	// Why the sheet opens read-only, if it does. Once the round is over it also wraps up when
	// it ended and when the org submitted.
	const hasEnded = iteration.status === "completed" || iteration.status === "stopped";
	const orgLabel = organizationName ?? "Your organization";
	const submittedNote = submittedAt ? `${orgLabel} submitted its results on ${formatDateTime(submittedAt)}.` : null;
	const notice =
		!isOwnLens ? [`Viewing ${organizationName ?? "another organization"}'s results. Review only.`, submittedNote].filter(Boolean).join(" ")
			: iteration.status === "not_started" ? "This round hasn't started yet. Testing opens once it begins."
				: hasEnded ? [
					`This round ${iteration.status === "stopped" ? "was stopped" : "ended"}${iteration.completedAt ? ` on ${formatDateTime(iteration.completedAt)}` : ""}.`,
					submittedNote ?? `${orgLabel} didn't submit before it closed.`,
					"Results are view only.",
				].join(" ")
					: submittedNote ? `${submittedNote} Results are view only${canWithdraw ? "; withdraw the submission to make changes until the round is completed" : ""}.`
						: null;
	// Submitted while the round runs gets the green "done" look.
	const isSubmittedNotice = isOwnLens && !hasEnded && !!submittedNote;

	return (
		<div className="flex-1 p-4 flex flex-col gap-4">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem><p className="text-xs text-muted-foreground">{suiteName}</p></BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem><p className="text-xs text-muted-foreground">{iteration.name}</p></BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem><p className="text-xs text-muted-foreground">{sectionName}</p></BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<div className="bg-gray-50/20 px-4 py-3 border rounded-md flex flex-col items-start gap-1 md:flex-row md:items-center md:justify-between md:gap-4">
					<div className="flex flex-row items-center gap-2">
						<TestCasesSidebarTrigger />
						<ClipboardIcon size={16} className="hidden lg:block" />
						<p className="font-medium text-xs">{sectionName}</p>
						{/* <div className="px-2 py-1 rounded-md bg-gray-200 text-gray-800 text-xs">
							<p className="text-xs font-medium"><span className="font-mono">{tested}</span>/<span className="font-mono">{inRun.length}</span> Test cases</p>
						</div> */}
					</div>
					<div className="flex flex-row justify-between items-center gap-2 w-full md:w-auto">
						{/* This section's progress (removed rows don't count). Hidden on mobile; the chips stay. */}
						<div className="flex flex-row items-center gap-2">
							<p className="text-xs text-muted-foreground">Iteration Summary:</p>
							<div className="px-2 py-1 rounded-md bg-green-200/20">
								<span className="flex flex-row items-center gap-1 text-xs text-green-800"><CircleCheck size={14} /><span className="font-mono">{passed}</span></span>
							</div>
							<div className="px-2 py-1 rounded-md bg-red-200/20">
								<span className="flex flex-row items-center gap-1 text-xs text-red-800"><CircleX size={14} /><span className="font-mono">{failed}</span></span>
							</div>
						</div>
						{submit && (
							<SubmitDialog
								iteration={iteration}
								organizationName={submit.organizationName}
								untestedCases={submit.untestedCases}
								trigger={
									<Button className="w-fit">
										<ClipboardCheck size={16} />
										<p className="text-xs">Submit Result</p>
									</Button>
								}
							/>
						)}
					</div>
				</div>
				{notice && (
					<div className={cn("flex flex-row flex-wrap items-center gap-2 rounded-md border px-4 py-2 text-xs text-muted-foreground", isSubmittedNotice && "border-green-800/30 bg-green-50/50")}>
						{isSubmittedNotice ? <CircleCheck className="size-4 shrink-0 text-green-800" /> : <Eye className="size-4 shrink-0" />}
						<p className={`flex-1 ${isSubmittedNotice ? "text-green-800" : "text-muted-foreground"}`}>
							{/* Numbers (dates, times) in mono; split keeps them at odd indexes. */}
							{notice.split(/(\d+(?::\d+)*)/).map((part, i) => (i % 2 ? <span key={i} className="font-mono">{part}</span> : part))}
						</p>
						{canWithdraw && <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto"><WithdrawButton iterationId={iteration.id} /></div>}
					</div>
				)}
				<div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
					<div className="flex flex-row flex-wrap items-center gap-2">
						{STATUS_FILTERS.map((filter) => {
							const Icon = filter.icon;
							return (
								<Button
									key={filter.value}
									size="sm"
									variant={statusFilter === filter.value ? "default" : "outline"}
									onClick={() => setStatusFilter(filter.value)}
								>
									<Icon size={15} className="mr-1" />
									<p className="text-xs">{filter.label}</p>
									<span className={cn("font-mono text-xs", statusFilter === filter.value ? "" : "text-muted-foreground")}>{rows.filter(filter.match).length}</span>
								</Button>
							)
						})}
					</div>
					<Select value={role} onValueChange={(value) => setRole(value ?? ALL_ROLES)}>
						<SelectTrigger size="sm" className="w-full text-xs md:w-48 md:text-sm">
							<SelectValue>{role === ALL_ROLES ? "All roles" : roleLabel(roles.find((r) => r.id === role) ?? { id: role, name: "" })}</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectItem value={ALL_ROLES} className="text-xs md:text-sm">All roles</SelectItem>
							{roles.map((r) => <SelectItem key={r.id} value={r.id} className="text-xs md:text-sm">{roleLabel(r)}</SelectItem>)}
						</SelectContent>
					</Select>
					<div className="relative w-full md:ml-auto md:w-64">
						<Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or title…" className="pl-8 text-xs md:text-xs" />
					</div>
				</div>
				{/* First column (change flags) shrinks to its chip with no padding; DataTable is shared, so override here. */}
				<div className="min-h-0 flex-1 [&_td:first-child]:w-px [&_td:first-child]:pl-4 [&_td:first-child]:pr-2 [&_th:first-child]:w-px [&_th:first-child]:p-0">
					<DataTable
						columns={testerColumns}
						data={visibleRows}
						// Deleted from the suite mid-round: shown for context, but no longer testable.
						isRowDisabled={(row) => row.pendingChange === "removed"}
						// Result writes don't revalidate; refresh on close so the tree's tested counts stay current.
						onDetailClose={() => router.refresh()}
						renderRowDetail={(row) => (
							<TestCaseSheet
								testCase={row}
								mode={canExecute && !isRemovedFromRound(row) ? "execute" : "review"}
								canRemark={canRemark}
								onChangeTestCase={(updated) => {
									setRows((current) => current.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
								}}
							/>
						)}
					/>
				</div>
		</div>
	);
}
