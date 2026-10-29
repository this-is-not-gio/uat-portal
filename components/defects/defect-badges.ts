import type { defectSeverity, defectStatus } from "@/lib/supabase/defects";

export const SEVERITY_CLASSNAMES: Record<defectSeverity, string> = {
	critical: "border-red-700 bg-red-100/60 text-red-700 dark:bg-red-950/40 dark:text-red-400",
	high: "border-orange-600/40 bg-orange-50 text-orange-800",
	medium: "border-yellow-600/40 bg-yellow-50 text-amber-800",
	low: "border-stone-400/40 bg-stone-50 text-stone-700",
};

export const STATUS_CLASSNAMES: Record<defectStatus, string> = {
	open: "border-blue-600/40 bg-blue-50 text-blue-800",
	resolved: "border-green-600/40 bg-green-50 text-green-800",
	wont_fix: "text-muted-foreground",
};
