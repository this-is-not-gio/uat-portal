import { Activity, CircleCheckBig, ClipboardList, ListChecks, Paperclip, Stamp, type LucideIcon } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";

export type testingsuiteLifeCycle = Database["public"]["Enums"]["suite_status"];

export const statusMapping: Record<testingsuiteLifeCycle, { Icon: LucideIcon, label: string, className: string, nextStatusIcon: LucideIcon | null }> = {
	draft: { Icon: ClipboardList, label: "Drafting", className: "bg-gray-500/10 border-gray-800/50 text-gray-800", nextStatusIcon: CircleCheckBig },
	ready: { Icon: CircleCheckBig, label: "For Testing", className: "bg-green-500/10 border-green-800/50 text-green-800", nextStatusIcon: ListChecks },
	in_testing: { Icon: ListChecks, label: "In Testing", className: "bg-blue-500/10 border-blue-800/50 text-blue-800", nextStatusIcon: Stamp },
	sign_off_issued: { Icon: Stamp, label: "Sign-off Issued", className: "bg-amber-500/10 border-amber-800/50 text-amber-800", nextStatusIcon: Activity },
	signed_off: { Icon: Activity, label: "Signed Off", className: "bg-purple-500/20 border-purple-800/50 text-purple-800", nextStatusIcon: Paperclip },
	archived: { Icon: Paperclip, label: "Archived", className: "bg-red-500/20 border-red-800/50 text-red-800", nextStatusIcon: ClipboardList },
};

// The suite's lifecycle chip, as shown in the suite header and the Overview title.
export function SuiteStatusBadge({ status }: { status: testingsuiteLifeCycle }) {
	const { Icon, label, className } = statusMapping[status];
	return (
		<div className={`flex flex-row items-center gap-1 rounded-md py-1.5 px-2 w-fit ${className}`}>
			<Icon size={12} />
			<p className="text-xs font-semibold">{label}</p>
		</div>
	);
}
