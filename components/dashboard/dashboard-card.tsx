import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_TONES, type PanelTone } from "@/components/dashboard/dashboard-panel";

type DashboardCardProps = {
	Icon: LucideIcon;
	tone: PanelTone;
	title: string;
	description?: string;
	// Right side of the header, e.g. a badge or a link.
	action?: ReactNode;
	children?: ReactNode;
	className?: string;
};

// Standalone card for the client dashboards: icon tile + title on top, free-form content below.
export function DashboardCard({ Icon, tone, title, description, action, children, className }: DashboardCardProps) {
	return (
		<section className={cn("flex flex-col rounded-md border border-gray-600/40", className)}>
			<div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b p-4 border-gray-600/40 bg-gray-50/10">
				<div className="flex flex-row items-center gap-2">
					<div className={cn("rounded-md border p-2", PANEL_TONES[tone].tile)}>
						<Icon className="size-5" />
					</div>
					<div>
						<h2 className="text-xs font-medium">{title}</h2>
						{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
					</div>
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}
