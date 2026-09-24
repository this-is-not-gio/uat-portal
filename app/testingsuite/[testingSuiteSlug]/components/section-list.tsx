"use client";

import { useState } from "react";
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderSections } from "@/lib/supabase/authoring-actions";
import SectionRow from "./section-row";

type SectionItem = { id: string; name: string; slug: string };

// Drag-and-drop reordering for the section tree. Reorders optimistically,
// then persists via reorderSections — on failure, falls back to the
// server-given order so the UI doesn't drift from the database.
export default function SectionList({
	sections,
	testSuiteSlug,
	suiteId,
	testCaseCounts,
}: {
	sections: SectionItem[];
	testSuiteSlug: string;
	suiteId: string;
	testCaseCounts: Map<string, number>;
}) {
	const [order, setOrder] = useState(sections);
	// Tracks the last `sections` prop we've synced from, so a genuine
	// server-driven change (add/delete/rename) can reset local order without
	// an effect — adjusting state during render, per React's own guidance.
	const [syncedSections, setSyncedSections] = useState(sections);
	if (sections !== syncedSections) {
		setSyncedSections(sections);
		setOrder(sections);
	}

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
	);

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = order.findIndex((section) => section.id === active.id);
		const newIndex = order.findIndex((section) => section.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const previous = order;
		const next = arrayMove(order, oldIndex, newIndex);
		setOrder(next);

		const result = await reorderSections({ suiteId, sectionIds: next.map((section) => section.id) });
		if (!result.ok) setOrder(previous);
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={order.map((section) => section.id)} strategy={verticalListSortingStrategy}>
				{order.map((section) => (
					<SortableSectionRow
						key={section.id}
						section={section}
						testSuiteSlug={testSuiteSlug}
						suiteId={suiteId}
						testCaseCount={testCaseCounts.get(section.id) ?? 0}
					/>
				))}
			</SortableContext>
		</DndContext>
	);
}

function SortableSectionRow({
	section,
	testSuiteSlug,
	suiteId,
	testCaseCount,
}: {
	section: SectionItem;
	testSuiteSlug: string;
	suiteId: string;
	testCaseCount: number;
}) {
	const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: section.id });

	return (
		<SectionRow
			name={section.name}
			id={section.id}
			slug={section.slug}
			testSuiteSlug={testSuiteSlug}
			suiteId={suiteId}
			testCaseCount={testCaseCount}
			dragRef={setNodeRef}
			dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
			dragAttributes={attributes}
			dragListeners={listeners}
			isDragging={isDragging}
		/>
	);
}
