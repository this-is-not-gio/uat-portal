"use client"

import { useTable, type ColumnDef, type RowData } from "@tanstack/react-table"

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
import { useState } from "react"

interface DataTableProps<TData extends RowData> {
	columns: ColumnDef<DataTableFeatures, TData>[]
	data: TData[]
	renderRowDetail?: (row: TData) => React.ReactNode
}


export function DataTable<TData extends RowData>({
	columns,
	data,
	renderRowDetail,
}: DataTableProps<TData>) {
	const table = useTable<DataTableFeatures, TData>({
		data,
		columns,
		features,
		initialState: {
			pagination: {
				pageSize: 9999,
				pageIndex: 0
			},
		}
	})
	const [openRowId, setOpenRowId] = useState<string | null>(null)

	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{
							table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{
										headerGroup.headers.map((header) => (
											<TableHead key={header.id} className="bg-gray-50 text-xs first:pl-4 last:pr-4 last:text-right">
												{header.isPlaceholder ? null : (
													<table.FlexRender header={header} />
												)}
											</TableHead>
										))
									}
								</TableRow>
							))
						}
					</TableHeader>
					<TableBody>
						{
							table.getRowModel().rows.length ? (
								table.getRowModel().rows.map((row) => {
									const cells = row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id} className="first:pl-4 last:pr-4 text-sm">
											<table.FlexRender cell={cell} />
										</TableCell>
									))

									if (!renderRowDetail) {
										return <TableRow key={row.id}>{cells}</TableRow>
									}

									return (
										// <Sheet key={row.id}>
										// 	<SheetTrigger
										// 		nativeButton={false}
										// 		render={
										// 			<TableRow className="cursor-pointer">
										// 				{cells}
										// 			</TableRow>
										// 		}
										// 	/>
										// 	{renderRowDetail(row.original)}
										// </Sheet>
										<Sheet key={row.id} open={openRowId === row.id} onOpenChange={(open) => setOpenRowId(open ? row.id : null)}>
											<SheetTrigger
											nativeButton={false}
												render={
													<TableRow className="cursor-pointer">
														{cells}
													</TableRow>
												}
											/>
											{openRowId === row.id ? renderRowDetail(row.original) : null}
										</Sheet>

									)
								})
							) : (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-24 text-center">
										No results.
									</TableCell>
								</TableRow>
							)
						}
					</TableBody>
				</Table>
			</div>
			{/* <div className="flex items-center justify-between px-1">
				<p className="text-xs text-muted-foreground">
					Page {table.state.pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
				</p>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div> */}
		</div>
	)

}
