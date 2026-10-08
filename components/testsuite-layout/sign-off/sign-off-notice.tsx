import { Ban, CircleCheck, CircleX, FilePen, Send } from "lucide-react";
import { cn } from "cn";
import { formatTimestamp } from "@/lib/utils";
import type { FrozenSignOffReport } from "@/lib/supabase/sign-off-report";

// Status strip above the paper (like Google Docs' "older version" bar): what happened to the open
// version. Screen only; the paper keeps the record (issued/acknowledged/rejected by and when).
// Colours follow SIGN_OFF_PILL. Withdrawn wins: an acknowledged sign-off can be withdrawn later.
export function SignOffNotice({ frozen, draft = false }: { frozen: FrozenSignOffReport; draft?: boolean }) {
	const by = (who: string | null) => (who ? ` by ${who}` : "");

	if (draft) {
		return (
			<Strip tone="amber" icon={<FilePen />} title="Draft · not issued yet">
				The client can&apos;t see this report until you issue it. Figures update with the latest results until then.
			</Strip>
		);
	}
	if (frozen.revokedAt) {
		return (
			<Strip tone="gray" icon={<Ban />} title={`Withdrawn on ${formatTimestamp(frozen.revokedAt)}`}>
				A new test iteration started after this sign-off. It is kept for the record.
			</Strip>
		);
	}
	if (frozen.rejectedAt) {
		return (
			<Strip tone="red" icon={<CircleX />} title={`Rejected on ${formatTimestamp(frozen.rejectedAt)}${by(frozen.rejectedBy)}`}>
				{frozen.rejectionReason && <p className="max-h-32 overflow-y-auto whitespace-pre-wrap">{frozen.rejectionReason}</p>}
			</Strip>
		);
	}
	if (frozen.acknowledgedAt) {
		return <Strip tone="green" icon={<CircleCheck />} title={`Acknowledged on ${formatTimestamp(frozen.acknowledgedAt)}${by(frozen.acknowledgedBy)}`} />;
	}
	return (
		<Strip tone="blue" icon={<Send />} title={`Issued on ${formatTimestamp(frozen.signedOffAt)}${by(frozen.signedOffBy)}`}>
			Awaiting the client&apos;s acknowledgement.
		</Strip>
	);
}

const TONES = {
	amber: "border-amber-600/30 bg-amber-50 text-amber-800",
	gray: "border-gray-400/40 bg-gray-50 text-gray-700",
	red: "border-red-600/30 bg-red-50 text-red-800",
	green: "border-green-700/30 bg-green-50 text-green-800",
	blue: "border-blue-600/30 bg-blue-50 text-blue-800",
} as const;

function Strip({ tone, icon, title, children }: { tone: keyof typeof TONES; icon: React.ReactNode; title: string; children?: React.ReactNode }) {
	return (
		<div role="status" className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm print:hidden [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", TONES[tone])}>
			{icon}
			<div className="flex min-w-0 flex-col gap-1">
				<p className="font-medium">{title}</p>
				{children && <div className="text-xs">{children}</div>}
			</div>
		</div>
	);
}
