"use client";

import * as React from "react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { File, Folder, ChevronRight, ClipboardList } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SectionLeaf({
	name,
	slug,
	testSuiteSlug,
	itemtype,
	className,
	onClick,
	...rest
}: {
	name: string;
	id: string;
	slug: string;
	testSuiteSlug: string;
	itemtype?: "section" | "test-case" | "test-suite";
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
			<IconComponent />
			{name}
		</SidebarMenuButton>
	)
}
