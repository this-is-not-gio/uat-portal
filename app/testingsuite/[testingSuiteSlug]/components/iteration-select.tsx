"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePathname, useRouter } from "next/navigation";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { formatIterationTimestamp } from "@/lib/utils";

export default function IterationSelect({
	iterations,
	selectedIteration,
}: {
	iterations: testIteration[];
	selectedIteration: testIteration | null;
}) {
	const router = useRouter();
	const pathname = usePathname();

	function handleIterationChange(value: string | null) {
		if (!value) return;
		router.replace(`${pathname}?tab=test-results&iteration=${value}`);
	}

	return (
		<Select
			value={selectedIteration ? String(selectedIteration.iterationNumber) : null}
			onValueChange={handleIterationChange}
			disabled={iterations.length === 0}
		>
			<SelectTrigger className="w-full">
				<SelectValue placeholder={iterations.length === 0 ? "No test iterations yet" : "Select a test result"}>
					{selectedIteration?.name}
				</SelectValue>
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false}>
				{
					iterations.map((iteration) => (
						<SelectItem key={iteration.id} value={String(iteration.iterationNumber)}>
							<div className="flex flex-col">
								<p className="text-sm">{iteration.name}</p>
								<p className="text-xs text-muted-foreground font-mono">{formatIterationTimestamp(iteration)}</p>
							</div>
						</SelectItem>
					))
				}
			</SelectContent>
		</Select>
	);
}
