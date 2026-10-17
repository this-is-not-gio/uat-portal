"use client"

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import { ClipboardList, FileSignature, MessageSquareReply, Reply, Send, Undo2, type LucideIcon } from "lucide-react";
import { DataTableFeatures } from "../table/data-table-features";
import { DataTable } from "../table/data-table";
import { Badge } from "../ui/badge";

// test: cases left to test | submit: all tested, not handed in | review: report awaiting acknowledgement
// review_returned: the report was rejected | follow_up / follow_up_review: being followed up with the vendor
export type ActionKind = "test" | "submit" | "review" | "review_returned" | "follow_up" | "follow_up_review";

export type ActionItemRow = {
	id: string;
	action: ActionKind;
	href: string;
	suiteCode: string | null;
	suiteName: string;
	// Null when the item isn't tied to a round (e.g. a report waiting for acknowledgement).
	roundName: string | null;
	timeline: { start: string | null; end: string | null };
	overdue: boolean;
	remaining: number;
};

const ACTIONS: Record<ActionKind, { Icon: LucideIcon; label: string; iconClassName: string; detail: (row: ActionItemRow) => string }> = {
	test: { Icon: ClipboardList, label: "Need to test", iconClassName: "text-emerald-600", detail: (row) => `${row.remaining} ${row.remaining === 1 ? "case" : "cases"} left to test` },
	submit: { Icon: Send, label: "Submit result", iconClassName: "text-blue-600", detail: () => "All test cases are done and ready for submission" },
	review: { Icon: FileSignature, label: "Need review", iconClassName: "text-orange-600", detail: () => "Report is waiting for your acknowledgement" },
	review_returned: { Icon: Undo2, label: "Review returned", iconClassName: "text-destructive", detail: () => "The report was rejected and sent back" },
	follow_up: { Icon: Reply, label: "Follow-up", iconClassName: "text-violet-600", detail: () => "Being followed up with the Development Team" },
	follow_up_review: { Icon: MessageSquareReply, label: "Follow-up review", iconClassName: "text-amber-600", detail: () => "Following up on the review" },
};

function formatDate(value: string | null) {
	if (!value) return "Not set"
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function ActionItemsTable({ rows }: { rows: ActionItemRow[] }) {
	const router = useRouter()
	const columnHelper = createColumnHelper<DataTableFeatures, ActionItemRow>()

	const columns = columnHelper.columns([
		columnHelper.display({
			header: "Iteration",
			cell: ({ row }) => <Link href={row.original.href} className="block hover:underline">
				<p className="text-sm font-medium">{row.original.roundName ?? "Sign-off report"}</p>
				<p className="text-xs text-muted-foreground font-mono">{row.original.suiteCode ? `${row.original.suiteCode} - ` : ""}{row.original.suiteName}</p>
			</Link>,
		}),
		columnHelper.display({
			header: "Iteration Timeline",
			cell: ({ row }) => <div className="flex gap-4 items-center">
				<div>
					<p className="font-mono">{formatDate(row.original.timeline.start)}</p>
					<p className="text-xs text-muted-foreground">Started</p>
				</div>
				<p className="text-xs text-muted-foreground">TO</p>
				<div>
					<p className="font-mono">{formatDate(row.original.timeline.end)}</p>
					<p className="text-xs text-muted-foreground">Planned end</p>
				</div>
			</div>,
		}),
		columnHelper.display({
			header: "Action Needed",
			cell: ({ row }) => {
				const { Icon, label, iconClassName, detail } = ACTIONS[row.original.action]
				return <div className="flex flex-row items-center gap-2">
					{/* <Icon className={`size-4 shrink-0 ${iconClassName}`} />
					<div>
						<p className="text-sm font-medium">{label}</p>
						<p className="text-xs text-muted-foreground">{detail(row.original)}</p>
					</div> */}
					<Icon className={`size-4 shrink-0`} />
					<p className="text-xs font-medium">{label} <span className="text-xs text-muted-foreground"> - {detail(row.original)}</span></p>
				</div>
			},
		}),
		columnHelper.display({
			id: "overdue",
			cell: ({ row }) => row.original.overdue ? (
				<Badge variant="destructive" className="gap-1.5">
					<span className="relative flex size-2 shrink-0">
						<span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
						<span className="relative inline-flex size-2 rounded-full bg-destructive" />
					</span>
					Overdue
				</Badge>
			) : null,
		}),
	])

	return (
		<DataTable columns={columns} data={rows} bordered={false} onRowClick={(row) => router.push(row.href)} />
	)
}
