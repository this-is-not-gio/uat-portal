import { Building2, Code2, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { orgType } from "@/lib/supabase/organizations";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import { cn } from "@/lib/utils";

const ORG_TYPE_STYLES: Record<orgType, { icon: typeof Globe; className: string }> = {
	vendor: { icon: Code2, className: "border-slate-400/40 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-800 dark:text-slate-300" },
	client: { icon: Building2, className: "border-sky-600/30 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-300" },
	external: { icon: Globe, className: "border-violet-600/30 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-950/40 dark:text-violet-300" },
};

// An organization's type (Internal / External / Development Team).
export function OrgTypeBadge({ type, className }: { type: orgType; className?: string }) {
	const { icon: Icon, className: styles } = ORG_TYPE_STYLES[type];
	return (
		<Badge variant="outline" className={cn("text-xs", styles, className)}>
			<Icon data-icon="inline-start" size={12} />
			{ORG_TYPE_LABELS[type]}
		</Badge>
	);
}
