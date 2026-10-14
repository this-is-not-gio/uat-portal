"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/table/data-table";
import type { DataTableFeatures } from "@/components/table/data-table-features";
import type { ReportHeader } from "@/lib/supabase/sign-off-report";
import { BADGE_VARIANTS } from "@/components/sidebar/app-sidebar";
import { cn, formatTimestamp, initials } from "@/lib/utils";
import { User } from "lucide-react";

// Client island for the report header's participants: column defs hold cell functions,
// which can't cross from the Server Component report view into DataTable.

type Participant = ReportHeader["participants"][number];
type testerRow = { id: string; name: string | null; roleName?: string; organizationType: Participant["organizationType"]; submittedAt: string | null };

const columnHelper = createColumnHelper<DataTableFeatures, testerRow>();

const columns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: "Tester Name",
		cell: (info) => {
			const name = info.getValue() ?? "Unknown";
			const { organizationType, roleName } = info.row.original;
			return (
				<div className="flex flex-row items-center gap-2">
					<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", (BADGE_VARIANTS[organizationType as keyof typeof BADGE_VARIANTS] ?? BADGE_VARIANTS.fallback).UserClassName)}>
						<p className="text-xs font-bold text-white">{info.getValue() ? initials(name) : "?"}</p>
					</div>
					<div className="flex flex-col gap-0">
						<p className="text-xs font-semibold">{name}</p>
						{roleName && <p className="text-xs text-muted-foreground">{roleName}</p>}
					</div>
				</div>
			);
		}
	}),
	columnHelper.accessor("submittedAt", {
		header: "Submitted",
		cell: (info) => <p className="text-xs text-muted-foreground">{info.getValue() ? formatTimestamp(info.getValue()!) : "Not submitted"}</p>
	}),
]);

// One card per organization: name and tester count on the grey bar, its testers in a table below.
export function ParticipantsTable({ participants }: { participants: Participant[] }) {
	return (
		<>
			{participants.map((p) => {
				const testers = p.testers ?? [];
				return (
					<div key={p.organizationName} className="rounded-md border print:break-inside-avoid">
						<div className="flex items-center justify-between gap-2 border-b bg-gray-100 p-3">
							<p className="text-xs font-semibold">{p.organizationName}</p>
							<div className="flex items-center justify-center gap-1">
								<User className="size-4" />
								<p className="inline text-xs"><span className="font-semibold font-mono">{testers.length}</span></p>
							</div>
						</div>
						{testers.length > 0 ? (
							<DataTable
								bordered={false}
								columns={columns}
								data={testers.map((t, i) => ({ id: `${p.organizationName}-${i}`, organizationType: p.organizationType, ...t }))}
							/>
						) : (
							// Reports frozen before testers were recorded only know the org's own submission.
							<p className="p-3 text-xs text-muted-foreground">{p.submittedAt ? `Submitted ${formatTimestamp(p.submittedAt)}` : "Not submitted"}</p>
						)}
					</div>
				);
			})}
		</>
	);
}
