"use client";

import * as React from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { File, Folder, ChevronRight, ClipboardList, GripVertical } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SectionLeaf({
	name,
	slug,
	testSuiteSlug,
	itemtype,
	className,
	onClick,
	dragAttributes,
	dragListeners,
	rowHighlighted,
	...rest
}: {
	name: string;
	id: string;
	slug: string;
	testSuiteSlug: string;
	itemtype?: "section" | "test-case" | "test-suite";
	dragAttributes?: DraggableAttributes;
	dragListeners?: DraggableSyntheticListeners;
	// Whether the row this icon belongs to is currently hovered — the icon
	// switches to a drag handle whenever the whole row is highlighted, not
	// only when the mouse is precisely over the small icon itself.
	rowHighlighted?: boolean;
} & React.ComponentProps<typeof SidebarMenuButton>) {
	const router = useRouter();
	const pathname = usePathname();

	const targetPath = `/testingsuite/${testSuiteSlug}/${slug}`;

	// When used as a Collapsible's trigger, `onClick` here is the toggle
	// handler Base UI merges in — fire it, then also navigate.
	function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
		onClick?.(event);
		router.push(`${targetPath}?tab=test-cases`);
	}

	const isActive = pathname === targetPath;
	const isFolder = itemtype === "test-suite";

	const IconMapping = {
		"section": ClipboardList,
		"test-case": File,
		"test-suite": Folder,
	};

	const IconComponent = itemtype ? IconMapping[itemtype] : Folder;
	const draggable = !!dragListeners;

	return (
		<SidebarMenuButton
			{...rest}
			onClick={handleClick}
			data-active={isActive}
			className={cn(isFolder && "group/collapsible", className)}
		>
			{isFolder && (
				<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
			)}
			{draggable ? (
				// The section's own icon doubles as the drag handle: once the row
				// is highlighted it swaps to a grip icon and grabs the pointer for
				// dnd-kit, while the rest of the row still navigates on click.
				<span
					className="-m-1 flex items-center justify-center p-1 cursor-grab active:cursor-grabbing"
					onClick={(event) => event.stopPropagation()}
					{...dragAttributes}
					{...dragListeners}
				>
					{rowHighlighted ? <GripVertical className="size-4" /> : <IconComponent />}
				</span>
			) : (
				<IconComponent />
			)}
			{name}
		</SidebarMenuButton>
	)
}
