"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTimestamp } from "@/lib/utils";
import type { signOff } from "@/lib/supabase/overview";

// Sign-off tab: switches between the suite's sign-offs (earlier and withdrawn ones included).
const statusOf = (s: signOff) => (s.revokedAt ? "Withdrawn" : s.acknowledgedAt ? "Signed off" : "Awaiting acknowledgement");
const labelOf = (s: signOff) => `${s.iterationName} · ${statusOf(s)} · ${formatTimestamp(s.signedOffAt)}`;

export function SignOffPicker({ suiteSlug, signOffs, selectedId }: { suiteSlug: string; signOffs: signOff[]; selectedId: string }) {
	const router = useRouter();
	const selected = signOffs.find((s) => s.id === selectedId);

	return (
		<Select value={selectedId} onValueChange={(id) => id && router.replace(`/testingsuite/${suiteSlug}?tab=sign-off&signOff=${id}`)}>
			<SelectTrigger className="w-fit">
				<SelectValue>{selected ? labelOf(selected) : "Select a sign-off"}</SelectValue>
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false}>
				{signOffs.map((s) => <SelectItem key={s.id} value={s.id}>{labelOf(s)}</SelectItem>)}
			</SelectContent>
		</Select>
	);
}
