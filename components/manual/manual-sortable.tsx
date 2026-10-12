"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

type result = { ok: true } | { ok: false; error: string };

// Drag-to-reorder for one parent's children (modules, a module's sections, or a container's
// blocks). Reorders optimistically, saves through `onReorder`, and rolls back with an error
// toast if saving fails. Items can only move within this list, never between parents.
export function ManualSortableList<T extends { id: string }>({
	items,
	onReorder,
	children,
}: {
	items: T[];
	onReorder: (ids: string[]) => Promise<result>;
	children: (ordered: T[]) => ReactNode;
}) {
	const [order, setOrder] = useState(items);
	// A new `items` prop (server refresh, add/delete) resets the local order. Adjusting state
	// during render, as in the test case section list.
	const [synced, setSynced] = useState(items);
	if (items !== synced) {
		setSynced(items);
		setOrder(items);
	}

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	// Pinned so the DndContext aria ids match between server and client render.
	const dndContextId = useId();

	async function handleDragEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return;
		const from = order.findIndex((item) => item.id === active.id);
		const to = order.findIndex((item) => item.id === over.id);
		if (from === -1 || to === -1) return;

		const previous = order;
		const next = arrayMove(order, from, to);
		setOrder(next);

		const saved = await onReorder(next.map((item) => item.id));
		if (!saved.ok) {
			setOrder(previous);
			toast.error(saved.error || "Couldn't save the new order.");
		}
	}

	return (
		<DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={order.map((item) => item.id)} strategy={verticalListSortingStrategy}>
				{children(order)}
			</SortableContext>
		</DndContext>
	);
}

// One draggable row. Only the grip `handle` starts a drag, so the rest of the row (links,
// buttons) behaves normally. `handle` is null unless `editing`.
export function ManualSortableRow({
	id,
	editing,
	children,
}: {
	id: string;
	editing: boolean;
	children: (row: {
		setNodeRef: (node: HTMLElement | null) => void;
		style: CSSProperties;
		isDragging: boolean;
		handle: ReactNode;
	}) => ReactNode;
}) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id,
		disabled: !editing,
	});
	const handle = editing ? (
		<button
			type="button"
			ref={setActivatorNodeRef}
			aria-label="Drag to reorder"
			title="Drag to reorder"
			className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent active:cursor-grabbing"
			{...attributes}
			{...listeners}
		>
			<GripVertical className="size-3.5" />
		</button>
	) : null;

	return children({
		setNodeRef,
		style: { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : undefined },
		isDragging,
		handle,
	});
}
