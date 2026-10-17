import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";

export const PANEL_TONES = {
	emerald: { tile: "bg-emerald-50 text-emerald-600 border-emerald-600/40", icon: "text-emerald-600" },
	blue: { tile: "bg-blue-50 text-blue-600 border-blue-600/40", icon: "text-blue-600" },
	violet: { tile: "bg-violet-50 text-violet-600 border-violet-600/40", icon: "text-violet-600" },
	orange: { tile: "bg-orange-50 text-orange-600 border-orange-600/40", icon: "text-orange-600" },
};

export type PanelTone = keyof typeof PANEL_TONES;

type PanelProps = {
	id?: string;
	Icon: LucideIcon;
	tone: PanelTone;
	title: string;
	description: string;
	// Right side of the header, e.g. a count badge.
	action?: ReactNode;
	// Shown instead of the body when there is nothing to list.
	empty?: { title: string; description: string };
	// A short list scrolls inside the panel; a table (scroll=false) sizes itself.
	scroll?: boolean;
	children?: ReactNode;
	className?: string;
};

// Bordered section used across the client dashboards: icon tile + title header, then the body or an empty state.
export function DashboardPanel({ id, Icon, tone, title, description, action, empty, scroll = true, children, className }: PanelProps) {
	const body = empty ? (
		<div className="flex flex-1 p-10">
			<EmptyState size="sm" title={empty.title} description={empty.description} icon={Icon} />
		</div>
	) : scroll ? (
		<ScrollArea className="h-64">
			<div className="flex flex-col gap-2 p-2">{children}</div>
		</ScrollArea>
	) : (
		children
	);

	return (
		<section id={id} className={cn("scroll-mt-4 h-fit rounded-md border border-gray-600/40 bg-gray-50/10", className)}>
			<div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-gray-600/40 p-4">
				<div className="flex flex-row items-center gap-2">
					<div className={cn("rounded-md border p-2", PANEL_TONES[tone].tile)}>
						<Icon className="size-5" />
					</div>
					<div>
						<h2 className="text-xs font-medium">{title}</h2>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
				</div>
				{action}
			</div>
			{body}
		</section>
	);
}

// One clickable entry in a panel list: leading icon, title + detail, and an optional trailing value.
export function DashboardRow({ href, Icon, iconClassName, title, detail, trailing }: { href: string; Icon: LucideIcon; iconClassName: string; title: ReactNode; detail: string; trailing?: ReactNode }) {
	return (
		<Link href={href} className="text-xs focus-visible:outline-2 focus-visible:outline-offset-2">
			<div className="flex w-full flex-row items-center gap-3 rounded-md border border-gray-600/40 bg-gray-50/10 px-4 py-2 transition-colors hover:bg-muted/50">
				<Icon className={cn("size-4 shrink-0", iconClassName)} />
				<div className="flex min-w-0 flex-col">
					<span className="truncate font-medium">{title}</span>
					<span className="truncate text-muted-foreground">{detail}</span>
				</div>
				{trailing ? <div className="ml-auto shrink-0 pl-2 text-muted-foreground">{trailing}</div> : null}
			</div>
		</Link>
	);
}
