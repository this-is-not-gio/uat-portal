"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyIterationSync } from "@/lib/supabase/sync-actions";
import type { scopeOption } from "@/lib/supabase/iteration-actions";

export type addableSection = { id: string; name: string; testCases: (scopeOption & { alreadyIncluded: boolean })[] };

// Same Select-multiple checklist as IterationScopePicker (Start Iteration's
// section picker), but for adding more sections' test cases into an already
// running round instead of choosing the round's initial scope. Only
// complete, not-yet-included cases are actually added — apply_iteration_sync
// enforces the same rule.
export default function AddTestCasesControl({ iterationId, sections }: { iterationId: string; sections: addableSection[] }) {
	const [sectionIds, setSectionIds] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function eligibleIds(ids: string[]) {
		return sections
			.filter((section) => ids.includes(section.id))
			.flatMap((section) => section.testCases.filter((tc) => tc.issues.length === 0 && !tc.alreadyIncluded).map((tc) => tc.id));
	}

	const selectedSections = sections.filter((section) => sectionIds.includes(section.id));
	const newCount = eligibleIds(sectionIds).length;

	function onAdd() {
		setError(null);
		startTransition(async () => {
			const result = await applyIterationSync({ iterationId, add: eligibleIds(sectionIds), refreshIds: [], remove: [] });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setSectionIds([]);
		});
	}

	return (
		<div className="flex flex-col gap-1">
			<div className="flex flex-row items-center gap-2">
				<Select multiple value={sectionIds} onValueChange={setSectionIds} disabled={isPending}>
					<SelectTrigger className="w-56">
						<SelectValue placeholder="Add sections…">
							{selectedSections.length === 0
								? undefined
								: selectedSections.length === 1
									? selectedSections[0].name
									: `${selectedSections.length} sections selected`}
						</SelectValue>
					</SelectTrigger>
					<SelectContent alignItemWithTrigger={false}>
						{sections.map((section) => {
							const newReady = section.testCases.filter((tc) => tc.issues.length === 0 && !tc.alreadyIncluded).length;
							return (
								<SelectItem key={section.id} value={section.id} disabled={newReady === 0}>
									<div className="flex flex-col">
										<p className="text-sm">{section.name}</p>
										<p className="text-xs text-muted-foreground">{newReady} new of {section.testCases.length} ready to add</p>
									</div>
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
				<Button size="sm" onClick={onAdd} disabled={isPending || newCount === 0}>
					<Plus className="size-4" />
					{isPending ? "Adding…" : newCount > 0 ? `Add ${newCount}` : "Add"}
				</Button>
			</div>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
