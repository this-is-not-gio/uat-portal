"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getIterationScopeOptions, type scopeOption } from "@/lib/supabase/iteration-actions";
import { READINESS_ISSUES } from "./suite-status-button";

// Start Iteration picks the sections to start with; every complete test case
// in them becomes the round's scope. More sections are added to a running
// round separately, once the iteration exists.
export default function IterationScopePicker({
	suiteId,
	onChange,
	disabled,
}: {
	suiteId: string;
	onChange: (next: Set<string>) => void;
	disabled?: boolean;
}) {
	const [sections, setSections] = useState<{ id: string; name: string; testCases: scopeOption[] }[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sectionIds, setSectionIds] = useState<string[]>([]);

	useEffect(() => {
		let cancelled = false;
		getIterationScopeOptions({ suiteId }).then((result) => {
			if (cancelled) return;
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setSections(result.data.sections);
		});
		return () => { cancelled = true; };
	}, [suiteId]);

	function pickSections(ids: string[]) {
		setSectionIds(ids);
		const completeIds = (sections ?? [])
			.filter((section) => ids.includes(section.id))
			.flatMap((section) => section.testCases.filter((tc) => tc.issues.length === 0).map((tc) => tc.id));
		onChange(new Set(completeIds));
	}

	if (error) return <p className="text-xs text-destructive">{error}</p>;
	if (!sections) return <p className="text-xs text-muted-foreground">Loading sections…</p>;

	const selectedSections = sections.filter((s) => sectionIds.includes(s.id));
	const completeCount = selectedSections.reduce((sum, s) => sum + s.testCases.filter((tc) => tc.issues.length === 0).length, 0);
	const incompleteCases = selectedSections.flatMap((s) => s.testCases.filter((tc) => tc.issues.length > 0));

	return (
		<div className="flex flex-col gap-1">
			<Label className="text-xs text-muted-foreground">Initial testing sections</Label>
			<Select multiple value={sectionIds} onValueChange={pickSections} disabled={disabled}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Choose sections">
						{selectedSections.length === 0
							? undefined
							: selectedSections.length === 1
								? selectedSections[0].name
								: `${selectedSections.length} sections selected`}
					</SelectValue>
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					{sections.map((section) => {
						const complete = section.testCases.filter((tc) => tc.issues.length === 0).length;
						return (
							<SelectItem key={section.id} value={section.id} disabled={complete === 0}>
								<div className="flex flex-col">
									<p className="text-sm">{section.name}</p>
									<p className="text-xs text-muted-foreground">{complete} of {section.testCases.length} ready</p>
								</div>
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>
			{selectedSections.length > 0 && (
				<p className="text-xs text-muted-foreground">
					{completeCount} test case{completeCount === 1 ? "" : "s"} will be copied into this round as Untested.
					{incompleteCases.length > 0 && (
						<>
							{" "}{incompleteCases.length} incomplete case{incompleteCases.length === 1 ? "" : "s"} will be skipped: {incompleteCases.map((tc) => `${tc.title} (${tc.issues.map((i) => READINESS_ISSUES[i] ?? i).join(", ")})`).join("; ")}
						</>
					)}
				</p>
			)}
		</div>
	);
}
