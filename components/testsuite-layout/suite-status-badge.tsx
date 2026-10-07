import { Activity, CircleCheckBig, ClipboardList, ListChecks, Paperclip, Stamp, type LucideIcon } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "cn";

export type testingsuiteLifeCycle = Database["public"]["Enums"]["suite_status"];
export const statusMapping: Record<testingsuiteLifeCycle, { Icon: LucideIcon, label: string, className: string, IconColor: string, nextStatusIcon: LucideIcon | null }> = {
	draft: { Icon: ClipboardList, label: "Drafting", className: "bg-gray-500/10 border-gray-800/50 text-gray-800 border-gray-800", IconColor: "text-gray-800", nextStatusIcon: CircleCheckBig },
	ready: { Icon: CircleCheckBig, label: "For Testing", className: "bg-green-500/10 border-green-800/50 text-green-800 border-green-800", IconColor: "text-green-800", nextStatusIcon: ListChecks },
	in_testing: { Icon: ListChecks, label: "In Testing", className: "bg-blue-500/10 border-blue-800/50 text-blue-800 border-blue-800", IconColor: "text-blue-800", nextStatusIcon: Stamp },
	sign_off_issued: { Icon: Stamp, label: "Sign-off Issued", className: "bg-amber-500/10 border-amber-800/50 text-amber-800 border-amber-800", IconColor: "text-amber-800", nextStatusIcon: Activity },
	signed_off: { Icon: Activity, label: "Signed Off", className: "bg-purple-500/20 border-purple-800/50 text-purple-800 border-purple-800", IconColor: "text-purple-800", nextStatusIcon: Paperclip },
	archived: { Icon: Paperclip, label: "Archived", className: "bg-red-500/20 border-red-800/50 text-red-800 border-red-800", IconColor: "text-red-800", nextStatusIcon: ClipboardList },
};

// The suite's lifecycle chip, as shown in the suite header and the Overview title.
// export function SuiteStatusBadge({ status }: { status: testingsuiteLifeCycle }) {
// 	const { Icon, label, className, IconColor } = statusMapping[status];
// 	return (
// 		<div className={cn("flex flex-row items-center justify-center gap-1 rounded-md size-12", className)}>
// 			<Icon size={30} className={`text-red-900!`} />
// 		</div>
// 	);
// }
