import { formatTimestamp } from "@/lib/utils";
import type { FrozenSignOffReport } from "@/lib/supabase/sign-off-report";
import { SignOffStatusBadge, type signOffStatus } from "./sign-off-status-badge";

// Sign-off details for the document's bottom-right panel: status, round, and who issued, acknowledged,
// rejected or withdrew it. Rows the sign-off hasn't reached yet are left out.
export function SignOffInfo({ status, frozen, isDraft }: { status: signOffStatus; frozen: FrozenSignOffReport | null; isDraft: boolean }) {
	return (
		<div className="flex flex-col gap-3">
			{frozen && (
				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
					{isDraft ? (
						<Row label="Issued" value="Not issued yet" />
					) : (
						<Row label="Issued" value={formatTimestamp(frozen.signedOffAt)} by={frozen.signedOffBy} />
					)}
					{frozen.acknowledgedAt && <Row label="Acknowledged" value={formatTimestamp(frozen.acknowledgedAt)} by={frozen.acknowledgedBy} />}
					{frozen.rejectedAt && <Row label="Rejected" value={formatTimestamp(frozen.rejectedAt)} by={frozen.rejectedBy} />}
					{frozen.revokedAt && <Row label="Withdrawn" value={formatTimestamp(frozen.revokedAt)} />}
					{frozen.note && <Row label="Note" value={frozen.note} />}
				</dl>
			)}
		</div>
	);
}

function Row({ label, value, by }: { label: string; value: string; by?: string | null }) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">
				{value}
				{by && <span className="block text-muted-foreground">by {by}</span>}
			</dd>
		</>
	);
}
