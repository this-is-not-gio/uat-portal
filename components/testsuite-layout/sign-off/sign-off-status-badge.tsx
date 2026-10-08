import { cn } from "cn";
import type { signOff } from "@/lib/supabase/overview";

export type signOffStatus = "drafting" | "issued" | "awaiting_acknowledgement" | "rejected" | "acknowledged" | "withdrawn";

// Sign-off pills, like the suite header's iteration status: the vendor creating the report (yellow)
// → issued to the client (blue) → rejected (red) or acknowledged (green). Only the open states pulse.
export const SIGN_OFF_PILL: Record<signOffStatus, { label: string; className: string; dot: string; ping?: string }> = {
	drafting: { label: "Creating Draft", className: "bg-yellow-500/10 text-amber-700", dot: "bg-amber-600", ping: "bg-amber-400" },
	issued: { label: "Sign-off Issued", className: "bg-blue-500/10 text-blue-700", dot: "bg-blue-600", ping: "bg-blue-400" },
	awaiting_acknowledgement: { label: "Awaiting Your Sign-off", className: "bg-blue-500/10 text-blue-700", dot: "bg-blue-600", ping: "bg-blue-400" },
	rejected: { label: "Sign-off Rejected", className: "bg-red-500/10 text-red-700", dot: "bg-red-600" },
	acknowledged: { label: "Sign-off Acknowledged", className: "bg-green-500/10 text-green-800", dot: "bg-green-700" },
	withdrawn: { label: "Sign-off Withdrawn", className: "bg-gray-500/10 text-gray-700", dot: "bg-gray-600" },
};

// An issued sign-off reads as "issued" to the vendor who sent it and "awaiting your sign-off" to
// the client who has to act on it.
export function signOffStatusOf(s: Pick<signOff, "status">, viewer: "vendor" | "client" = "vendor"): signOffStatus {
	return s.status === "issued" && viewer === "client" ? "awaiting_acknowledgement" : s.status;
}

export function SignOffStatusBadge({ status, className }: { status: signOffStatus; className?: string }) {
	const pill = SIGN_OFF_PILL[status];
	return (
		<div className={cn("flex w-fit flex-row items-center gap-1.5 rounded-md px-3 py-1.5", pill.className, className)}>
			<span className="relative flex size-2 shrink-0">
				{pill.ping && <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", pill.ping)} />}
				<span className={cn("relative inline-flex size-2 rounded-full", pill.dot)} />
			</span>
			<p className="text-xs font-semibold whitespace-nowrap">{pill.label}</p>
		</div>
	);
}
