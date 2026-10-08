"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/table/data-table";
import type { DataTableFeatures } from "@/components/table/data-table-features";
import type { ReportHeader } from "@/lib/supabase/sign-off-report";
import { formatTimestamp } from "@/lib/utils";
import { AudienceBadge } from "../audience-badge";
import { audience } from "@/lib/supabase/test-cases";
import { organization } from "@/lib/supabase/organizations";

// Client island for the report header's participants: column defs hold cell functions,
// which can't cross from the Server Component report view into DataTable.

type participantRow = ReportHeader["participants"][number] & { id: string };

const columnHelper = createColumnHelper<DataTableFeatures, participantRow>();

const ORG_AUDIENCE: Record<organization["type"], audience> = {
      client: "internal",
      vendor: "internal",
      external: "external",
};

const columns = columnHelper.columns([
	columnHelper.accessor("organizationName", {
		header: "Organization",
		cell: (info) => <p className="text-xs font-semibold">{info.getValue()}</p>
	}),
	columnHelper.accessor("organizationType", {
		header: "Type",
		cell: (info) => {
			return  <AudienceBadge audience={ORG_AUDIENCE[info.getValue() as keyof typeof ORG_AUDIENCE]} /> 
		}
	}),
	columnHelper.display({
		id: "submitted",
		header: "Submitted On",
		cell: ({ row: { original: p } }) =>
			p.withdrawnAt ? <Badge variant="outline">Withdrawn {formatTimestamp(p.withdrawnAt)}</Badge>
			: p.submittedAt ? <p className="text-xs font-mono text-muted-foreground"> {formatTimestamp(p.submittedAt)}</p>
			: <Badge variant="destructive">Not submitted</Badge>,
	}),
]);

export function ParticipantsTable({ participants }: { participants: ReportHeader["participants"] }) {
	// DataTable keys rows by id; org names are unique within a round.
	return <DataTable columns={columns} data={participants.map((p) => ({ ...p, id: p.organizationName }))} />;
}
