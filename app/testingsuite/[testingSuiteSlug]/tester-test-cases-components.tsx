"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { CircleCheck, CircleX, ClipboardIcon, Eye, Info, Search, TriangleAlert, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/table/data-table";
import { type DataTableFeatures } from "@/components/table/data-table-features";
import { TestStatusMapping } from "@/components/table/columns";
import { RemarkCountCell, ResultSummaryCell } from "@/components/table/test-result-columns";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import type { testIteration, testResultRow } from "@/lib/supabase/test-iterations";
import { cn } from "@/lib/utils";
import { WithdrawButton } from "./components/submission-bar";

type statusFilter = "all" | "untested" | "failed" | "changed";
const ALL_ROLES = "__all__";

const isUntested = (row: testResultRow) => row.status === "Untested" || row.status === "In Progress";
// Vendor sync touched it this round, or it was edited/removed after it was tested.
const isChanged = (row: testResultRow) => row.syncKind !== null || row.pendingChange !== undefined;

const STATUS_FILTERS: { value: statusFilter; label: string; match: (row: testResultRow) => boolean }[] = [
	{ value: "all", label: "All", match: () => true },
	{ value: "untested", label: "Untested", match: isUntested },
	{ value: "failed", label: "Failed", match: (row) => row.status === "Failed" },
	{ value: "changed", label: "Changed", match: isChanged },
];

function changeLabel(row: testResultRow): string | null {
	if (row.pendingChange === "changed") return "Edited after testing; the new version comes next round.";
	if (row.pendingChange === "removed") return "Removed from the suite; its results stay in this round.";
	if (row.syncKind === "added") return "Added mid-round.";
	if (row.syncKind === "updated") return "Updated mid-round.";
	if (row.syncKind === "force_reset") return `Results reset by the vendor${row.archives[0]?.reason ? `: ${row.archives[0].reason}` : "."}`;
	return null;
}

const formatDateTime = (iso: string) => format(parseISO(iso), "MMM d yyyy, h:mm a");

const columnHelper = createColumnHelper<DataTableFeatures, testResultRow>();

const testerColumns = columnHelper.columns([
	// columnHelper.accessor("code", {
	// 	header: "Code",
	// 	cell: (info) => <p className="text-xs font-mono text-muted-foreground">{info.getValue() ?? "—"}</p>,
	// }),
	columnHelper.display({
		header: "Test Case",
		cell: (info) => {
			return (
				<div className="flex flex-col gap-1">
					<p className="text-sm">{info.row.original.title}</p>
					<p className="text-xs font-mono text-muted-foreground">{info.row.original.code ?? "—"}</p>
				</div>
			);
		},
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Account Role",
		cell: (info) => <p className="text-xs text-muted-foreground">{info.getValue() ?? "—"}</p>,
	}),
	columnHelper.display({
		header: "Remarks",
		cell: (info) => <RemarkCountCell row={info.row.original} />,
	}),
	columnHelper.display({
		header: "Test Summary",
		cell: (info) => <ResultSummaryCell row={info.row.original} />,
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => {
			const value = info.getValue();
			const status = TestStatusMapping[value as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			return (
				<div className="flex items-end justify-end">
					<Badge className={`text-xs ${value === "Passed" ? "bg-green-100 text-green-800" : ""}`} variant={status?.variant || "outline"}>
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
	submission,
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
	// Submit bar (running round only), rendered by the server tab.
	submission?: React.ReactNode;
}) {
	const router = useRouter();
	const [rows, setRows] = useState<testResultRow[]>(results);
	const [statusFilter, setStatusFilter] = useState<statusFilter>("all");
	const [role, setRole] = useState<string>(ALL_ROLES);
	const [search, setSearch] = useState("");

	const roles = useMemo(
		() => [...new Set(rows.map((row) => row.roleAssignee).filter((r): r is string => !!r))].sort(),
		[rows]
	);
	const tested = rows.filter((row) => !isUntested(row)).length;
	const passed = rows.filter((row) => row.status === "Passed").length;
	const failed = rows.filter((row) => row.status === "Failed").length;

	const query = search.trim().toLowerCase();
	const activeFilter = STATUS_FILTERS.find((f) => f.value === statusFilter) ?? STATUS_FILTERS[0];
	const visibleRows = rows
		.filter(activeFilter.match)
		.filter((row) => role === ALL_ROLES || row.roleAssignee === role)
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
		<ScrollArea className="flex-1 shrink-0 flex flex-col px-2">
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
				<div className="bg-gray-50/20 px-4 py-3 border rounded-md flex flex-row items-center justify-between gap-4">
					<div className="flex flex-row items-center gap-2">
						<ClipboardIcon size={16} />
						<p className="font-medium">{sectionName}</p>
						<div className="px-2 py-1 rounded-md bg-gray-200 text-gray-800 text-xs">
							<p className="text-xs font-medium"><span className="font-mono">{tested}</span>/<span className="font-mono">{rows.length}</span> Test cases</p>
						</div>
					</div>
					<div className="flex flex-row items-center gap-2">
						<div className="px-2 py-1 rounded-md bg-green-200/20">
							<span className="flex flex-row items-center gap-1 text-xs text-green-800"><CircleCheck size={14} /><span className="font-mono">{passed}</span></span>
						</div>
						<div className="px-2 py-1 rounded-md bg-red-200/20">
							<span className="flex flex-row items-center gap-1 text-xs text-red-800"><CircleX size={14} /><span className="font-mono">{failed}</span></span>
						</div>
						
					</div>
				</div>
				{notice && (
					<div className={cn("flex flex-row items-center gap-2 rounded-md border px-4 py-2 text-xs text-muted-foreground", isSubmittedNotice && "border-green-800/30 bg-green-50/50")}>
						{isSubmittedNotice ? <CircleCheck className="size-4 shrink-0 text-green-800" /> : <Eye className="size-4 shrink-0" />}
						<p className={`flex-1 ${isSubmittedNotice ? "text-green-800" : "text-muted-foreground"}`}>{notice}</p>
						{canWithdraw && <WithdrawButton iterationId={iteration.id} />}
					</div>
				)}
				<div className="flex flex-row flex-wrap items-center gap-2">
					{STATUS_FILTERS.map((filter) => (
						<Button
							key={filter.value}
							size="sm"
							variant={statusFilter === filter.value ? "default" : "outline"}
							onClick={() => setStatusFilter(filter.value)}
						>
							<p className="text-xs">{filter.label}</p>
							<span className={cn("font-mono text-xs", statusFilter === filter.value ? "" : "text-muted-foreground")}>{rows.filter(filter.match).length}</span>
						</Button>
					))}
					<Select value={role} onValueChange={(value) => setRole(value ?? ALL_ROLES)}>
						<SelectTrigger size="sm" className="w-48">
							<SelectValue>{role === ALL_ROLES ? "All roles" : role}</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectItem value={ALL_ROLES}>All roles</SelectItem>
							{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
						</SelectContent>
					</Select>
					<div className="relative ml-auto w-64">
						<Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or title…" className="pl-8" />
					</div>
				</div>
				<div className="min-h-0 flex-1">
					<DataTable
						columns={testerColumns}
						data={visibleRows}
						// Result writes don't revalidate; refresh on close so the tree's tested counts stay current.
						onDetailClose={() => router.refresh()}
						renderRowDetail={(row) => (
							<TestCaseSheet
								testCase={row}
								mode={canExecute ? "execute" : "review"}
								canRemark={canRemark}
								onChangeTestCase={(updated) => {
									setRows((current) => current.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
								}}
							/>
						)}
					/>
				</div>
			</div>
		</ScrollArea>
	);
}
