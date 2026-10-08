"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import type { DataTableFeatures } from "@/components/table/data-table-features";
import type { CriterionResult, ReportHeader } from "@/lib/supabase/sign-off-report";
import { cn, formatTimestamp } from "@/lib/utils";
import { AudienceBadge } from "../audience-badge";
import { audience } from "@/lib/supabase/test-cases";
import { organization } from "@/lib/supabase/organizations";
import { CheckIcon, XIcon } from "lucide-react";

// Client island for the report header's participants: column defs hold cell functions,
// which can't cross from the Server Component report view into DataTable.

type VerdictRow = CriterionResult & { id: string };

const columnHelper = createColumnHelper<DataTableFeatures, VerdictRow>();

const formatCriterionValue = (row: VerdictRow, value: number | string) =>
      row.key === "minPassRate" && typeof value === "number" ? `${value}%` : String(value);

const columns = columnHelper.columns([
		columnHelper.accessor("met", {
		header: "",
		cell: (info) => {
			const met = info.getValue();
			return (
				// <div className="flex flex-row justify-end">
				// 	<div className={cn("flex flex-row items-center gap-1 py-1 px-2  rounded-md w-fit", met ? "text-green-700 bg-green-200/20" : "text-red-700 bg-red-200/20")}>
				// 		{
				// 			met ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />
				// 		}
				// 	</div>
				// </div>
				<div className={cn("flex flex-row items-center p-1 rounded-md w-fit border", met ? "text-green-800 bg-green-200/20 border-green-800" : "text-red-800 bg-red-200/20 border-red-800")}>
					{met ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
				</div>
			);
		},
	}),
	columnHelper.accessor("label", {
		header: "Criterion",
		cell: (info) => <p className="text-xs font-semibold">{info.getValue()}</p>
	}),
	columnHelper.accessor("actual", {
		header: "Actual",
		cell: (info) => <p className="text-xs font-mono">{formatCriterionValue(info.row.original, info.getValue())}</p>
	}),
	columnHelper.accessor("threshold", {
		header: "Required",
		cell: (info) => <p className="text-xs font-mono">{formatCriterionValue(info.row.original, info.getValue())}</p>
	}),


]);

export function VerdictTable({ criteria }: { criteria: CriterionResult[] }) {
	return <DataTable columns={columns} data={criteria.map((c) => ({ ...c, id: c.key }))} />;
}
// export function ParticipantsTable({ participants }: { participants: ReportHeader["participants"] }) {
// 	// DataTable keys rows by id; org names are unique within a round.
// 	return <DataTable columns={columns} data={participants.map((p) => ({ ...p, id: p.organizationName }))} />;
// }
