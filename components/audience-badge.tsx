import { Building2, Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { audience } from "@/lib/supabase/test-cases";
import { cn } from "@/lib/utils";

// Who a test case is meant for. Drives which participating orgs get a result row for it.
export const AUDIENCE_LABELS: Record<audience, string> = {
	internal: "Internal",
	external: "External",
	both: "Internal & External",
};

export const AUDIENCE_DESCRIPTIONS: Record<audience, string> = {
	internal: "Tested by the client's staff",
	external: "Tested by the client's external companies",
	both: "Tested by the client's staff and external companies",
};

// Same icon wherever an audience shows (badge, scope chips).
export const AUDIENCE_ICONS: Record<audience, typeof Users> = {
	internal: Building2,
	external: Globe,
	both: Users,
};

const AUDIENCE_STYLES: Record<audience, { icon: typeof Users; className: string }> = {
	internal: { icon: AUDIENCE_ICONS.internal, className: "border-sky-600/30 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-300" },
	external: { icon: AUDIENCE_ICONS.external, className: "border-violet-600/30 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-950/40 dark:text-violet-300" },
	both: { icon: AUDIENCE_ICONS.both, className: "border-slate-400/40 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-800 dark:text-slate-300" },
};

export function AudienceBadge({ audience, className }: { audience: audience; className?: string }) {
	const { icon: Icon, className: styles } = AUDIENCE_STYLES[audience];
	return (
		<Badge variant="outline" className={cn("text-xs", styles, className)}>
			<Icon data-icon="inline-start" size={12} />
			{AUDIENCE_LABELS[audience]}
		</Badge>
	);
}
