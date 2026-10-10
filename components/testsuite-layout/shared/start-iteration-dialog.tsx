"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Play, TriangleAlert, X } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createRound, getIterationScopeOptions, previewRoundCoverage, type scopeOption } from "@/lib/supabase/iteration-actions";
import type { roundCoverage } from "@/lib/supabase/test-iterations";
import { CoverageView } from "@/components/testsuite-layout/test-cases/coverage-panel";
import { coverageBlockers } from "@/components/testsuite-layout/test-cases/coverage-blockers";
import { testCasesHref } from "@/components/testsuite-layout/test-cases/href";

type scopeSection = { id: string; name: string; testCases: scopeOption[] };

const STEPS = ["Details", "Scope", "Coverage", "Review"] as const;

// Plans the next test round in four steps (#11): name and end date, scope (sections, then
// individual cases), coverage (who tests which role) and a review. Nothing is saved until the
// last step creates the round, still not started, so its page keeps editing scope and roster.
// A blank name falls back to Untitled_Iteration_{n} (start_iteration, 0027). With
// `testSuiteSlug`, the dialog closes onto the new round's page.
export default function StartIterationDialog({
	suiteId,
	testSuiteSlug,
	trigger,
}: {
	suiteId: string;
	testSuiteSlug?: string;
	trigger?: React.ReactElement;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState(0);
	const [name, setName] = useState("");
	const [plannedEndDate, setPlannedEndDate] = useState("");
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [sections, setSections] = useState<scopeSection[] | null>(null);
	// Test case ids in scope. Only cases without issues can be picked (apply_iteration_sync's rule).
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	// Users unticked on the coverage step; kept so going back to scope doesn't forget them.
	const [excluded, setExcluded] = useState<Set<string>>(new Set());
	const [coverage, setCoverage] = useState<roundCoverage | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	// Parsed as local time (not UTC) so the picker shows the same day that was typed/selected.
	const plannedEndDateValue = plannedEndDate ? new Date(`${plannedEndDate}T00:00:00`) : undefined;

	useEffect(() => {
		if (!open || sections) return;
		let cancelled = false;
		getIterationScopeOptions({ suiteId }).then((result) => {
			if (cancelled) return;
			if (result.ok) setSections(result.data.sections);
			else setError(result.error);
		}).catch(() => {
			if (!cancelled) setError("Couldn't load the suite's sections. Close and try again.");
		});
		return () => { cancelled = true; };
	}, [open, sections, suiteId]);

	const pickable = (section: scopeSection) => section.testCases.filter((tc) => tc.issues.length === 0);

	function toggleCases(ids: string[], on: boolean) {
		// The scope changed, so any earlier coverage no longer describes it.
		setCoverage(null);
		setSelected((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (on) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	}

	function toggleExpanded(sectionId: string) {
		setExpanded((current) => {
			const next = new Set(current);
			if (!next.delete(sectionId)) next.add(sectionId);
			return next;
		});
	}

	async function loadCoverage(nextExcluded: Set<string>) {
		const result = await previewRoundCoverage({ suiteId, testCaseIds: [...selected], excludedUserIds: [...nextExcluded] });
		if (result.ok) setCoverage(result.data);
		return result;
	}

	// Everyone unticked in the current coverage. Users from an earlier scope that no longer hold
	// a needed role are dropped, so the round only records ticks that mean something.
	const excludedNow = coverage
		? coverage.roles.flatMap((role) => role.orgs.flatMap((org) => org.users.filter((u) => !u.ticked).map((u) => u.userId)))
		: [];

	function goNext() {
		setError(null);
		if (step === 1) {
			startTransition(async () => {
				const result = await loadCoverage(excluded);
				if (!result.ok) { setError(result.error); return; }
				setStep(2);
			});
			return;
		}
		setStep(step + 1);
	}

	function onCreate() {
		setError(null);
		startTransition(async () => {
			const result = await createRound({ suiteId, name: name.trim(), plannedEndDate, testCaseIds: [...selected], excludedUserIds: excludedNow });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			reset();
			setOpen(false);
			if (testSuiteSlug) router.push(testCasesHref(testSuiteSlug, result.data.slug));
		});
	}

	function reset() {
		setStep(0);
		setName("");
		setPlannedEndDate("");
		setSections(null);
		setSelected(new Set());
		setExpanded(new Set());
		setExcluded(new Set());
		setCoverage(null);
		setError(null);
	}

	const blockers = coverage ? coverageBlockers(coverage) : [];
	const nextDisabled = isPending
		|| (step === 1 && selected.size === 0)
		|| (step === 2 && (!coverage || !coverage.canStart));

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
			<DialogTrigger
				render={trigger ?? (
					<Button className="flex flex-row items-center gap-2 w-full">
						<Play className="h-4 w-4" />
						<p className="text-xs">Start Iteration</p>
					</Button>
				)}
			/>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Play className="size-4" />
						Start a new test iteration
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Step {step + 1} of {STEPS.length}: {STEPS[step]}. Only one round can run at a time. Nothing is created until the last step.
					</DialogDescription>
					<ol className="flex flex-row items-center gap-2 pt-2" aria-label="Steps">
						{STEPS.map((label, index) => (
							<li key={label} className="flex flex-row items-center gap-2">
								<span className={cn(
									"text-xs rounded-full px-2 py-0.5 border",
									index === step ? "bg-primary text-primary-foreground border-primary" : index < step ? "text-foreground" : "text-muted-foreground",
								)}>{index + 1}. {label}</span>
							</li>
						))}
					</ol>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					{step === 0 && (
						<>
							<div className="flex flex-col gap-1">
								<Label htmlFor="iteration-name" className="text-xs text-muted-foreground flex flex-row justify-between">
									<span>Name</span>
									<span className="text-muted-foreground text-xs">(optional)</span>
								</Label>
								<Input
									id="iteration-name"
									placeholder="Untitled_Iteration"
									value={name}
									onChange={(event) => setName(event.target.value)}
									disabled={isPending}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label htmlFor="iteration-end" className="text-xs text-muted-foreground flex flex-row justify-between">
									<span>Planned end date</span>
									<span className="text-muted-foreground text-xs">(optional)</span>
								</Label>
								<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
									<PopoverTrigger
										render={
											<Button
												id="iteration-end"
												variant="outline"
												disabled={isPending}
												className={cn("w-full justify-start font-normal", !plannedEndDateValue && "text-muted-foreground")}
											>
												<CalendarIcon className="size-4" />
												{plannedEndDateValue ? format(plannedEndDateValue, "PPP") : "Pick a date"}
											</Button>
										}
									/>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={plannedEndDateValue}
											onSelect={(date) => {
												setPlannedEndDate(date ? format(date, "yyyy-MM-dd") : "");
												setDatePickerOpen(false);
											}}
											disabled={{ before: new Date() }}
										/>
									</PopoverContent>
								</Popover>
							</div>
						</>
					)}

					{step === 1 && (
						<div className="flex flex-col gap-2">
							<p className="text-xs text-muted-foreground">Tick whole sections, then untick the cases the round shouldn&apos;t run.</p>
							{!sections ? (
								<p className="text-xs text-muted-foreground text-center py-4">Loading sections…</p>
							) : sections.length === 0 ? (
								<p className="text-xs text-muted-foreground text-center py-4">This suite has no sections yet.</p>
							) : (
								<div className="border rounded-md divide-y">
									{sections.map((section) => {
										const ids = pickable(section).map((tc) => tc.id);
										const count = ids.filter((id) => selected.has(id)).length;
										const isOpen = expanded.has(section.id);
										return (
											<div key={section.id}>
												<div className="px-3 py-2 flex flex-row items-center gap-2">
													<Checkbox
														checked={ids.length > 0 && count === ids.length}
														indeterminate={count > 0 && count < ids.length}
														onCheckedChange={(checked) => toggleCases(ids, !!checked)}
														disabled={ids.length === 0}
														aria-label={`Select every case in ${section.name}`}
													/>
													<span className="text-xs font-medium flex-1">{section.name}</span>
													<Badge variant="secondary" className="text-xs">{count}/{section.testCases.length} selected</Badge>
													<Button
														variant="ghost"
														size="icon-sm"
														onClick={() => toggleExpanded(section.id)}
														aria-label={`${isOpen ? "Hide" : "Show"} cases in ${section.name}`}
														aria-expanded={isOpen}
													>
														<ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
													</Button>
												</div>
												{isOpen && (
													<div className="pl-9 pr-3 pb-2 flex flex-col gap-1">
														{section.testCases.map((tc) => (
															<label key={tc.id} className="flex flex-row items-center gap-2">
																<Checkbox
																	checked={selected.has(tc.id)}
																	onCheckedChange={(checked) => toggleCases([tc.id], !!checked)}
																	disabled={tc.issues.length > 0}
																/>
																<span className="text-xs">{[tc.code, tc.title].filter(Boolean).join(" ")}</span>
																{tc.issues.length > 0 && <span className="text-xs text-amber-800">Incomplete: {tc.issues.join(", ")}</span>}
															</label>
														))}
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
							<p className="text-xs text-muted-foreground">{selected.size} {selected.size === 1 ? "test case" : "test cases"} in scope</p>
						</div>
					)}

					{step === 2 && coverage && (
						<div className="flex flex-col gap-2">
							<p className="text-xs text-muted-foreground">Everyone holding a needed role is ticked. Untick anyone who shouldn&apos;t take part, or go back to trim cases.</p>
							<CoverageView
								key={[...selected].join(",")}
								coverage={coverage}
								onToggle={async (userIds, ticked) => {
									const next = new Set(excluded);
									for (const id of userIds) {
										if (ticked) next.delete(id);
										else next.add(id);
									}
									const result = await loadCoverage(next);
									if (result.ok) setExcluded(next);
									return result.ok ? { ok: true as const } : result;
								}}
								blockerExtra={<Button variant="outline" size="sm" className="self-start mt-1" onClick={() => setStep(1)}>Back to scope</Button>}
							/>
						</div>
					)}

					{step === 3 && coverage && sections && (
						<div className="flex flex-col gap-3 text-xs">
							<div className="rounded-md border p-3 flex flex-col gap-1">
								<p className="font-medium">{name.trim() || "Untitled_Iteration"}</p>
								<p className="text-muted-foreground">Planned end: {plannedEndDateValue ? format(plannedEndDateValue, "PPP") : "not set"}</p>
							</div>
							<div className="rounded-md border p-3 flex flex-col gap-1">
								<p className="font-medium">Scope · {selected.size} {selected.size === 1 ? "test case" : "test cases"}</p>
								<ul className="list-disc pl-5 text-muted-foreground">
									{sections.filter((section) => section.testCases.some((tc) => selected.has(tc.id))).map((section) => (
										<li key={section.id}>{section.name}: {section.testCases.filter((tc) => selected.has(tc.id)).length} of {section.testCases.length}</li>
									))}
								</ul>
							</div>
							<div className="rounded-md border p-3 flex flex-col gap-2">
								<p className="font-medium">Roles and testers</p>
								{coverage.roles.map((role) => (
									<div key={role.testRoleId} className="flex flex-col gap-0.5">
										<p>{role.name} <span className="text-muted-foreground">· {role.caseCount} {role.caseCount === 1 ? "case" : "cases"}</span></p>
										<ul className="list-disc pl-5 text-muted-foreground">
											{role.orgs.map((org) => {
												const ticked = org.users.filter((u) => u.ticked);
												if (ticked.length === 0) return null;
												return <li key={org.organizationId}>{org.name}: {ticked.map((u) => u.fullName ?? "Unnamed user").join(", ")}</li>;
											})}
										</ul>
									</div>
								))}
							</div>
							<p className="text-muted-foreground">The round is created as planned. Scope and testers can still be edited on its page until you start it.</p>
						</div>
					)}

					{step === 2 && !coverage && <p className="text-xs text-muted-foreground text-center py-4">Loading coverage…</p>}
					{step === 2 && coverage && blockers.length > 0 && (
						<p className="text-xs text-amber-800 flex flex-row items-center gap-1.5"><TriangleAlert size={14} /> Fix the issues above to continue.</p>
					)}
					{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					{step === 0 ? (
						<DialogClose render={<Button variant="outline" disabled={isPending} />}>
							<X className="size-4" />
							Cancel
						</DialogClose>
					) : (
						<Button variant="outline" onClick={() => { setError(null); setStep(step - 1); }} disabled={isPending}>
							<ChevronLeft className="size-4" />
							Back
						</Button>
					)}
					{step < STEPS.length - 1 ? (
						<Button onClick={goNext} disabled={nextDisabled}>
							{isPending ? "Working…" : "Next"}
							<ChevronRight className="size-4" />
						</Button>
					) : (
						<Button onClick={onCreate} disabled={isPending}>
							<Play className="size-4" />
							{isPending ? "Creating…" : "Create iteration"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
