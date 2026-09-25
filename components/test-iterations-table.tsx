"use client"

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataTable } from "@/components/table/data-table";
import { getIterationColumns } from "@/components/table/iteration-columns";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { cn } from "@/lib/utils";

export function TestIterationsTable({ iterations }: { iterations: testIteration[] }) {
	const [search, setSearch] = useState("");
	const columns = useMemo(() => getIterationColumns(), []);
	const filteredIterations = iterations.filter((iteration) =>
		iteration.name.toLowerCase().includes(search.trim().toLowerCase())
	);

	return (
		<div className="flex flex-col gap-4">
			<div
				className={cn(
					"border flex flex-row rounded-md border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 w-full items-center px-2 gap-2 h-9"
				)}
			>
				<Search size={14} className="shrink-0 text-muted-foreground" />
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Filter test iterations..."
					className="w-full bg-transparent border-0 outline-none text-xs placeholder:text-muted-foreground"
				/>
			</div>
			<DataTable columns={columns} data={filteredIterations} />
		</div>
	);
}
