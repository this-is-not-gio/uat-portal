"use client"

import { useTable, type ColumnDef, type RowData } from "@tanstack/react-table"
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DraggableAttributes,
	type DraggableSyntheticListeners,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"

import { features, type DataTableFeatures } from "./data-table-features"
import { ClipboardCheck, ClipboardIcon, ClipboardXIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { createContext, useContext, useId, useState } from "react"

// Lets a column's own cell render function (e.g. the leading status icon in
// columns.tsx) become the drag handle for row reordering, instead of DataTable
// prepending a separate handle column. `null` when the table isn't sortable.
type DragHandleProps = { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners } | null
const DragHandleContext = createContext<DragHandleProps>(null)
export function useDragHandle() {
	return useContext(DragHandleContext)
}

interface DataTableProps<TData extends RowData & { id: string }> {
	columns: ColumnDef<DataTableFeatures, TData>[]
	data: TData[]
	renderRowDetail?: (row: TData) => React.ReactNode
	// When set, rows get a drag handle and can be reordered; called with the
	// dragged row's id and the id it was dropped onto.
	onReorder?: (activeId: string, overId: string) => void
}


export function DataTable<TData extends RowData & { id: string }>({
	columns,
	data,
	renderRowDetail,
	onReorder,
}: DataTableProps<TData>) {
	const table = useTable<DataTableFeatures, TData>({
		data,
		columns,
		features,
		getRowId: (row) => row.id,
		initialState: {
			pagination: {
				pageSize: 9999,
				pageIndex: 0
			},
		}
	})
	const [openRowId, setOpenRowId] = useState<string | null>(null)
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
	)
	// DndContext generates internal ids (used in aria-describedby on draggable
	// elements) that aren't guaranteed stable between the server and client
	// render — passing our own via React's SSR-safe useId() avoids the mismatch.
	const dndContextId = useId()

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id || !onReorder) return
		onReorder(String(active.id), String(over.id))
	}

	const rows = table.getRowModel().rows

	const rowElements = rows.map((row) => (
		<DataRow
			key={row.id}
			rowId={row.id}
			sortable={!!onReorder}
			cells={row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id} className="first:pl-4 last:pr-4 text-sm last:text-right">
					<table.FlexRender cell={cell} />
				</TableCell>
			))}
			openRowId={openRowId}
			setOpenRowId={setOpenRowId}
			renderRowDetail={renderRowDetail ? () => renderRowDetail(row.original) : undefined}
		/>
	))

	const tableBody = (
		<TableBody>
			{
				rows.length ? (
					onReorder ? (
						<SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
							{rowElements}
						</SortableContext>
					) : (
						rowElements
					)
				) : (
					<TableRow>
						<TableCell colSpan={columns.length} className=" text-center last:border border-amber-400">
							No results.
						</TableCell>
					</TableRow>
				)
			}
		</TableBody>
	)

	const table_ = (
		<Table>
			<TableHeader>
				{
					table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{
								headerGroup.headers.map((header) => (
									<TableHead key={header.id} className="bg-gray-50 text-xs first:pl-4 last:pr-4 last:flex last:justify-end last:items-center 	">
										{header.isPlaceholder ? null : (
											<table.FlexRender header={header || null} />
										)}
									</TableHead>
								))
							}
						</TableRow>
					))
				}
			</TableHeader>
			{tableBody}
		</Table>
	)

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<div className="overflow-hidden rounded-md border">
				{
					// DndContext renders a11y-only <div>s (HiddenText/LiveRegion) as
					// siblings of its children, not wrapped in any DOM node — placing it
					// inside <Table>/<TableBody> put those divs directly under <table>
					// or <tbody>, which is invalid HTML and broke hydration. Wrapping
					// the whole table here instead keeps them as plain <div> siblings.
					onReorder ? (
						<DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
							{table_}
						</DndContext>
					) : table_
				}
			</div>
		</div>
	)

}

// Always calls useSortable (disabled when not `sortable`) so hook order stays
// stable regardless of whether drag-and-drop is enabled for this table.
function DataRow({
	rowId,
	cells,
	sortable,
	renderRowDetail,
	openRowId,
	setOpenRowId,
}: {
	rowId: string
	cells: React.ReactNode[]
	sortable: boolean
	renderRowDetail?: () => React.ReactNode
	openRowId: string | null
	setOpenRowId: (id: string | null) => void
}) {
	const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: rowId, disabled: !sortable })
	const style = sortable ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined } : undefined
	const dragHandle: DragHandleProps = sortable ? { attributes, listeners } : null

	const providedCells = (
		<DragHandleContext.Provider value={dragHandle}>
			{cells}
		</DragHandleContext.Provider>
	)

	if (!renderRowDetail) {
		return <TableRow ref={sortable ? setNodeRef : undefined} style={style} className="group/row">{providedCells}</TableRow>
	}

	return (
		<Sheet open={openRowId === rowId} onOpenChange={(open) => setOpenRowId(open ? rowId : null)}>
			<SheetTrigger
				nativeButton={false}
				render={
					<TableRow ref={sortable ? setNodeRef : undefined} style={style} className="group/row cursor-pointer">
						{providedCells}
					</TableRow>
				}
			/>
			{openRowId === rowId ? renderRowDetail() : null}
		</Sheet>
	)
}
