"use client";

import { useState } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import SectionLeaf from "./section-leaf";
import SectionMenu from "./section-menu";

// A section row in the Test Cases sidebar tree. Owns its own hover state so
// the Edit/Delete actions reveal only for this row, not every row at once.
// Optional drag props let SectionList (drag-and-drop reordering) wire this
// row into dnd-kit without SectionRow depending on it directly.
export default function SectionRow({
	name,
	id,
	slug,
	testSuiteSlug,
	suiteId,
	testCaseCount,
	dragRef,
	dragStyle,
	dragAttributes,
	dragListeners,
	isDragging,
}: {
	name: string;
	id: string;
	slug: string;
	testSuiteSlug: string;
	suiteId: string;
	testCaseCount: number;
	dragRef?: (node: HTMLLIElement | null) => void;
	dragStyle?: React.CSSProperties;
	dragAttributes?: DraggableAttributes;
	dragListeners?: DraggableSyntheticListeners;
	isDragging?: boolean;
}) {
	const [hovered, setHovered] = useState(false);

	return (
		<SidebarMenuItem
			ref={dragRef}
			style={dragStyle}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			className={isDragging ? "opacity-50" : undefined}
		>
			<SectionLeaf
				name={name}
				id={id}
				slug={slug}
				itemtype="section"
				testSuiteSlug={testSuiteSlug}
				className="group-has-data-[sidebar=menu-action]/menu-item:pr-14"
				dragAttributes={dragAttributes}
				dragListeners={dragListeners}
				rowHighlighted={hovered}
			/>
			<SectionMenu
				suiteId={suiteId}
				testSuiteSlug={testSuiteSlug}
				section={{ id, name }}
				testCaseCount={testCaseCount}
				visible={hovered}
			/>
		</SidebarMenuItem>
	);
}
