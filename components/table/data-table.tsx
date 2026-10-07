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
import { ClipboardCheck, ClipboardIcon, ClipboardXIcon, ChevronLeft, ChevronRight, FileIcon } from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { createContext, useContext, useId, useState } from "react"
import { EmptyState } from "../ui/empty-state"
import { cn } from "@/lib/utils"

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
	// Called when a row's detail sheet closes (e.g. to refresh server data it may have changed).
	onDetailClose?: () => void
	// Plain click handler for rows that navigate instead of opening a detail sheet.
	onRowClick?: (row: TData) => void
	// When set, rows get a drag handle and can be reordered; called with the
	// dragged row's id and the id it was dropped onto.
	onReorder?: (activeId: string, overId: string) => void
	// Off when the table sits inside a container that already draws the frame.
	bordered?: boolean
	// Rows shown faded and inert: no click, no detail sheet (e.g. a case removed from the suite).
	isRowDisabled?: (row: TData) => boolean
	// Keeps the last column left-aligned like the others instead of pushed to the end.
	notEnd?: boolean
}


export function DataTable<TData extends RowData & { id: string }>({
	columns,
	data,
	renderRowDetail,
	onDetailClose,
	onRowClick,
	onReorder,
	bordered = true,
	isRowDisabled,
	notEnd = false,
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
				<TableCell key={cell.id} className={cn(notEnd ? "first:pl-4 last:pr-4 text-xs" : "first:pl-4 last:pr-4 text-xs last:text-right", cell.column.columnDef.meta?.className)}>
					<table.FlexRender cell={cell} />
				</TableCell>
			))}
			openRowId={openRowId}
			setOpenRowId={setOpenRowId}
			renderRowDetail={renderRowDetail ? () => renderRowDetail(row.original) : undefined}
			onDetailClose={onDetailClose}
			onClick={onRowClick ? () => onRowClick(row.original) : undefined}
			disabled={isRowDisabled?.(row.original) ?? false}
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
						<TableCell colSpan={columns.length} className="">
							<EmptyState icon={FileIcon} title="No Test Cases" description="There are no test cases to display." />
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
									<TableHead key={header.id} className={cn(notEnd ? "bg-gray-50 text-xs first:pl-4 last:pr-4" : "bg-gray-50 text-xs first:pl-4 last:pr-4 last:text-right", header.column.columnDef.meta?.className)}>
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
			<div className={bordered ? "overflow-hidden rounded-md border" : "overflow-hidden"}>
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
	onDetailClose,
	onClick,
	disabled,
}: {
	rowId: string
	cells: React.ReactNode[]
	sortable: boolean
	renderRowDetail?: () => React.ReactNode
	openRowId: string | null
	setOpenRowId: (id: string | null) => void
	onDetailClose?: () => void
	onClick?: () => void
	disabled: boolean
}) {
	const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: rowId, disabled: !sortable })
	const style = sortable ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined } : undefined
	const dragHandle: DragHandleProps = sortable ? { attributes, listeners } : null

	const providedCells = (
		<DragHandleContext.Provider value={dragHandle}>
			{cells}
		</DragHandleContext.Provider>
	)

	if (disabled) {
		return (
			<TableRow ref={sortable ? setNodeRef : undefined} style={style} className="group/row opacity-50 cursor-not-allowed bg-muted/30 hover:bg-muted/30" aria-disabled>
				{providedCells}
			</TableRow>
		)
	}

	if (!renderRowDetail) {
		return (
			<TableRow ref={sortable ? setNodeRef : undefined} style={style} className={onClick ? "group/row cursor-pointer" : "group/row"} onClick={onClick}>
				{providedCells}
			</TableRow>
		)
	}

	return (
		<Sheet open={openRowId === rowId} onOpenChange={(open) => {
			setOpenRowId(open ? rowId : null)
			if (!open) onDetailClose?.()
		}}>
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
