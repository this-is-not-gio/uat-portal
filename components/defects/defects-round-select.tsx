"use client"

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";

// Picks the round whose defects the page lists; the choice lives in ?round= so the server page reloads the table.
export default function DefectsRoundSelect({ rounds, value }: { rounds: { id: string; name: string }[]; value: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();

	return (
		<div className="flex flex-row gap-1 justify-between items-end">
			<Button className="text-xs font-medium" onClick={() => startTransition(() => router.replace(pathname))} disabled={isPending}>
				<Plus className="size-4" />
				Report Defect
			</Button>
			<div className="flex flex-col gap-1 items-end">
				<p className="text-xs font-medium">Selected Iteration:</p>
				<Select
					value={value}
					onValueChange={(next) => next && startTransition(() => router.replace(`${pathname}?round=${next}`))}
					disabled={isPending}
				>
					<SelectTrigger className="w-56" aria-label="Testing round">
						<SelectValue>{rounds.find((r) => r.id === value)?.name}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{rounds.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}
	