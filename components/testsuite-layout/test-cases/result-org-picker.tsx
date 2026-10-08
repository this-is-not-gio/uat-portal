"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { organization } from "@/lib/supabase/organizations";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";

// Which participant's results the Test Results tab shows. Lives in the URL (?org=)
// so the server component can fetch just that org's rows.
export default function ResultOrgPicker({
	organizations,
	selectedId,
	ownOrgId,
}: {
	organizations: organization[];
	selectedId: string;
	// Marks the viewer's own org "(mine)" (tester Test Cases lens).
	ownOrgId?: string;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const selected = organizations.find((o) => o.id === selectedId);

	function pick(id: string | null) {
		if (!id) return;
		const params = new URLSearchParams(searchParams.toString());
		params.set("org", id);
		router.push(`${pathname}?${params.toString()}`);
	}

	return (
		<Select value={selectedId} onValueChange={pick}>
			<SelectTrigger className="w-full">
				<SelectValue>{selected?.name}{selected && selected.id === ownOrgId ? " (mine)" : ""}</SelectValue>
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false}>
				{organizations.map((org) => (
					<SelectItem key={org.id} value={org.id}>
						<div className="flex flex-col">
							<p className="text-sm">{org.name}{org.id === ownOrgId ? " (mine)" : ""}</p>
							<p className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</p>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
