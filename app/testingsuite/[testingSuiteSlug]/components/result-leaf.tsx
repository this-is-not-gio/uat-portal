"use client";

import * as React from "react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { File, Folder, FolderClock, ClipboardList } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIterationSelection } from "./iteration-selection-context";

// Test Results counterpart of SectionLeaf. Two node kinds:
// - "iteration" (folder): clicking it selects that round (its section
//   children are only known once fetched by the parent tree builder) and
//   resets to the "all sections" view of it.
// - "section" (leaf, nested under an iteration folder): clicking it selects
//   both that section AND the iteration it belongs to (`iterationNumber` is
//   the parent iteration's number, not whatever's currently in the URL).
export default function ResultLeaf({
	name,
	id,
	slug,
	testSuiteSlug,
	itemtype,
	iterationNumber,
	active,
	href,
	className,
	onClick,
	testCaseCount,
	...rest
}: {
	name: string;
	id: string;
	slug: string;
	testSuiteSlug: string;
	itemtype?: "section" | "test-case" | "test-suite" | "iteration" | "iteration-section";
	// The iteration this node belongs to (its own number, for an "iteration"
	// node; its parent iteration's number, for a "section" node).
	iterationNumber?: number;
	// Server-computed active state — whether this URL is derivable from
	// pathname alone (section nodes can be active in multiple iterations'
	// subtrees) makes client-side detection unreliable here.
	active?: boolean;
	// Full URL override — used when this tree is reused somewhere other than
	// the Test Results tab itself (e.g. the Test Cases tab's read-only
	// preview, which links into the path-based testing-itration screen
	// instead of `?tab=test-results`).
	href?: string;
	testCaseCount?: number;
} & React.ComponentProps<typeof SidebarMenuButton>) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const suitePath = `/testingsuite/${testSuiteSlug}`;
	const isIteration = itemtype === "iteration";
	const targetPath = isIteration ? `${suitePath}/all` : `${suitePath}/${slug}`;

	function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
		onClick?.(event);
		if (href) {
			router.push(href);
			return;
		}
		const iteration = iterationNumber ?? searchParams.get("iteration");
		router.push(`${targetPath}?tab=test-results${iteration ? `&iteration=${iteration}` : ""}`);
	}

	const isActive = active ?? (pathname === (href ?? targetPath) || (slug === "all" && pathname === suitePath));

	const IconMapping = {
		"section": ClipboardList,
		"test-case": File,
		"test-suite": Folder,
		"iteration": FolderClock,
		"iteration-section": ClipboardList,
	};

	const IconComponent = itemtype ? IconMapping[itemtype] : Folder;

	// Only "iteration-section" nodes are keyed "<iterationId>:<sectionSlug>" by
	// buildIterationTree/IterationTestCaseList — other node types just won't
	// have a matching entry, so this stays undefined for them.
	const { counts } = useIterationSelection();
	const selectedCount = itemtype === "iteration-section" ? (counts[id] ?? testCaseCount) : undefined;

	return (
		<SidebarMenuButton
			{...rest}
			onClick={handleClick}
			data-active={isActive || undefined}
			className={className}
		>
			<IconComponent />
			<div className="flex flex-row items-center gap-2 truncate">
			{name}
			{
				itemtype === "iteration-section" && (
					selectedCount !== undefined && selectedCount !== 0 ? (
						<Badge variant="secondary" className="text-xs ml-auto"><span className="font-mono">{selectedCount}</span> Test Cases</Badge>
					) : (
						<Badge variant="secondary" className="text-xs ml-auto">No Test Cases Included</Badge>
					)
				)
			}

			</div>
		</SidebarMenuButton>
	)
}
