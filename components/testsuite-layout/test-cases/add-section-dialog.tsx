"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, FolderPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ROUND_FLAG_STYLES } from "@/components/table/iteration-test-cases-columns";
import { roundFlagLabel } from "@/lib/supabase/case-states";
import { getIterationScopeOptions, type scopeOption } from "@/lib/supabase/iteration-actions";
import { applyIterationSync } from "@/lib/supabase/sync-actions";

type scopeSection = { id: string; name: string; testCases: scopeOption[] };

// Adds test cases to a planned round: pick a section, then tick the cases of it to test.
// Complete cases start ticked; incomplete ones (apply_iteration_sync rejects them) and cases
// already in the round are shown but can't be picked. Ticks are kept while switching sections,
// and one Add sends everything ticked across all of them.
export default function AddSectionDialog({
	suiteId,
	iterationId,
	includedCaseIds,
	open,
	onOpenChange,
}: {
	suiteId: string;
	iterationId: string;
	// Live test case ids the round already holds.
	includedCaseIds: Set<string>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [sections, setSections] = useState<scopeSection[] | null>(null);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	// Sections whose cases were already auto-ticked, so coming back to one doesn't re-tick what was unticked.
	const [visited, setVisited] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (!open || sections) return;
		let cancelled = false;
		getIterationScopeOptions({ suiteId, iterationId }).then((result) => {
			if (cancelled) return;
			if (result.ok) setSections(result.data.sections);
			else setError(result.error);
		}).catch(() => {
			if (!cancelled) setError("Couldn't load the suite's sections. Close and try again.");
		});
		return () => { cancelled = true; };
	}, [open, sections, suiteId, iterationId]);

	const pickable = (section: scopeSection) => section.testCases.filter((tc) => tc.issues.length === 0 && !includedCaseIds.has(tc.id));
	const active = sections?.find((section) => section.id === activeId) ?? null;

	function openSection(section: scopeSection) {
		setActiveId(section.id);
		if (visited.has(section.id)) return;
		setVisited((current) => new Set(current).add(section.id));
		setSelected((current) => {
			const next = new Set(current);
			for (const tc of pickable(section)) next.add(tc.id);
			return next;
		});
	}

	function toggleCases(ids: string[], on: boolean) {
		setSelected((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (on) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	}

	function reset() {
		setSections(null);
		setActiveId(null);
		setSelected(new Set());
		setVisited(new Set());
		setError(null);
	}

	function onAdd() {
		setError(null);
		startTransition(async () => {
			const result = await applyIterationSync({ iterationId, add: [...selected], refreshIds: [], remove: [] });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			reset();
			onOpenChange(false);
		});
	}

	const activePickable = active ? pickable(active).map((tc) => tc.id) : [];
	const activeCount = activePickable.filter((id) => selected.has(id)).length;

	return (
		<Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<FolderPlus className="size-4" />
						Add a section
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Pick a section, then choose which of its test cases this iteration will test.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3 px-2">
					<div className="flex flex-col gap-1">
						<p className="text-xs text-muted-foreground">Section</p>
						<ScrollArea className="border rounded-md max-h-40">
							<div className="flex flex-col gap-1 p-2">
								{!sections ? (
									<p className="text-xs text-muted-foreground text-center py-2">Loading sections…</p>
								) : sections.length === 0 ? (
									<p className="text-xs text-muted-foreground text-center py-2">This suite has no sections yet.</p>
								) : sections.map((section) => {
									const addable = pickable(section);
									const count = addable.filter((tc) => selected.has(tc.id)).length;
									return (
										<button
											key={section.id}
											type="button"
											onClick={() => openSection(section)}
											aria-pressed={section.id === activeId}
											className={cn(
												"flex flex-row items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left",
												section.id === activeId ? "border-primary bg-muted" : "hover:bg-muted/50",
											)}
										>
											<span className="text-xs font-medium">{section.name}</span>
											<span className="text-xs text-muted-foreground font-mono">
												{addable.length === 0 ? "nothing to add" : `${count}/${addable.length} selected`}
											</span>
										</button>
									);
								})}
							</div>
						</ScrollArea>
					</div>

					{active && (
						<div className="flex flex-col gap-1">
							<div className="flex flex-row items-center justify-between">
								<p className="text-xs text-muted-foreground">Test cases in {active.name}</p>
								<label className="flex flex-row items-center gap-2 text-xs">
									<Checkbox
										checked={activePickable.length > 0 && activeCount === activePickable.length}
										indeterminate={activeCount > 0 && activeCount < activePickable.length}
										onCheckedChange={(checked) => toggleCases(activePickable, !!checked)}
										disabled={activePickable.length === 0 || isPending}
									/>
									Select all
								</label>
							</div>
							<ScrollArea className="border rounded-md max-h-56">
								<div className="flex flex-col gap-1 p-2">
									{active.testCases.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">This section has no test cases.</p>}
									{active.testCases.map((tc) => {
										const inRound = includedCaseIds.has(tc.id);
										const incomplete = tc.issues.length > 0;
										return (
											<label key={tc.id} className="flex flex-row items-center gap-2 rounded-md border px-2 py-1.5">
												<Checkbox
													checked={inRound || selected.has(tc.id)}
													onCheckedChange={(checked) => toggleCases([tc.id], !!checked)}
													disabled={inRound || incomplete || isPending}
												/>
												<span className="text-xs flex-1">{[tc.code, tc.title].filter(Boolean).join(" ")}</span>
												{tc.flags.map((flag) => {
													const style = ROUND_FLAG_STYLES[flag.flag];
													return (
														<Badge key={flag.flag} variant="outline" className={cn("gap-1 text-xs", style.className)}>
															<style.icon size={12} />
															{roundFlagLabel(flag)}
														</Badge>
													);
												})}
												{inRound && <Badge variant="secondary" className="text-xs">In this round</Badge>}
												{incomplete && !inRound && <span className="text-xs text-amber-800">Incomplete: {tc.issues.join(", ")}</span>}
											</label>
										);
									})}
								</div>
							</ScrollArea>
						</div>
					)}
					{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Cancel
					</DialogClose>
					<Button onClick={onAdd} disabled={isPending || selected.size === 0}>
						<Check className="size-4" />
						{isPending ? "Adding…" : `Add ${selected.size} ${selected.size === 1 ? "test case" : "test cases"}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
