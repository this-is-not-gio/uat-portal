"use client";

import * as React from "react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { File, Folder, ChevronRight, ClipboardList } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Test Results counterpart of SectionLeaf: same icons, chevron and
// path-segment navigation, but stays on the Test Results tab and keeps the
// selected iteration in the URL.
export default function ResultLeaf({
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
	const searchParams = useSearchParams();

	const suitePath = `/testingsuite/${testSuiteSlug}`;
	const targetPath = `${suitePath}/${slug}`;

	// When used as a Collapsible's trigger, `onClick` here is the toggle
	// handler Base UI merges in — fire it, then also navigate.
	function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
		onClick?.(event);
		const iteration = searchParams.get("iteration");
		router.push(`${targetPath}?tab=test-results${iteration ? `&iteration=${iteration}` : ""}`);
	}

	// No section segment (e.g. arriving from the tab switcher) means "all".
	const isActive = pathname === targetPath || (slug === "all" && pathname === suitePath);
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
