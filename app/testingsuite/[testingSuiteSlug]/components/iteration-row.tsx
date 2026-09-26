"use client";

import { useState } from "react";
import IterationMenu from "./iteration-menu";
import type { testIteration } from "@/lib/supabase/test-iterations";

// Hover-state wrapper so an iteration row's Edit/Delete actions reveal only
// for that row, mirroring SectionRow for the Testing Suite tree. Only wraps
// the iteration's own header line (chevron + leaf) — never its nested
// section children, which sit as a sibling in CollapsibleContent, not a
// descendant of this div. Wrapping the whole subtree here previously made
// hovering a child section bubble up and reveal the parent iteration's menu.
export default function IterationRow({ iteration, suiteId, testSuiteSlug, sectionsNotIncluded, children }: {
	iteration: testIteration;
	suiteId: string;
	testSuiteSlug: string;
	sectionsNotIncluded?: { id: string; name: string; slug: string; testCasesLength: number; testCaseIds: string[] }[];
	children: React.ReactNode;
}) {
	const [hovered, setHovered] = useState(false);

	return (
		<div className="relative flex flex-row items-center" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
			{children}
			<IterationMenu iteration={iteration} suiteId={suiteId} testSuiteSlug={testSuiteSlug} sectionsNotIncluded={sectionsNotIncluded} visible={hovered} />
		</div>
	);
}
