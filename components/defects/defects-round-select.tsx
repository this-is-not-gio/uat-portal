"use client"

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Picks the round whose defects the page lists; the choice lives in ?round= so the server page reloads the table.
export default function DefectsRoundSelect({ rounds, value }: { rounds: { id: string; name: string }[]; value: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();

	return (
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
	)
}
