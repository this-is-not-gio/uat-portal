import { CircleCheck, CircleDot, CircleSlash, Feather, Flame, Hourglass, Zap, type LucideIcon } from "lucide-react";
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

// Icons for the severity / status fields in the defect sheet.
export const SEVERITY_ICONS: Record<defectSeverity, LucideIcon> = {
	critical: Flame,
	high: Zap,
	medium: Hourglass,
	low: Feather,
};

export const STATUS_ICONS: Record<defectStatus, LucideIcon> = {
	open: CircleDot,
	resolved: CircleCheck,
	wont_fix: CircleSlash,
};

// Icon colours for the status icon, matching the table.
export const STATUS_ICON_CLASSNAMES: Record<defectStatus, string> = {
	open: "text-emerald-600",
	resolved: "text-purple-600",
	wont_fix: "text-stone-400",
};

// Trigger styling once a status is picked (border + background + text), matching the table's icon colours.
export const STATUS_FIELD_CLASSNAMES: Record<defectStatus, string> = {
	open: "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
	resolved: "border-purple-600/40 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400",
	wont_fix: "border-stone-400/40 bg-stone-50 text-stone-600",
};
