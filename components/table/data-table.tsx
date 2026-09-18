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
	})

	return (
		<div className="overflow-hidden rounded-md border">
			<Table>
				<TableHeader>
					{
						table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{
									headerGroup.headers.map((header) => (
										<TableHead key={header.id} className="bg-gray-50 px-4">
											{header.isPlaceholder ? null : (
												<table.FlexRender header={header}/>
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
									<TableCell key={cell.id} className="px-4 text-sm">
										<table.FlexRender cell={cell}/>
									</TableCell>
								))

								if (!renderRowDetail) {
									return <TableRow key={row.id}>{cells}</TableRow>
								}

								return (
									<Sheet key={row.id}>
										<SheetTrigger
											nativeButton={false}
											render={
												<TableRow className="cursor-pointer">
													{cells}
												</TableRow>
											}
										/>
										{renderRowDetail(row.original)}
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
	)

}
