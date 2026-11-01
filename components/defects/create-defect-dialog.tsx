"use client";

import { useEffect, useState, useTransition } from "react";
import { Bug, Check, ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEVERITY_CLASSNAMES } from "./defect-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { createDefect, getRoundFailedCases } from "@/lib/supabase/defect-actions";
import { DEFECT_SEVERITIES, externalUrlError } from "@/lib/supabase/defect-format";
import type { defectSeverity } from "@/lib/supabase/defects";
import type { signedAttachment } from "@/lib/supabase/attachment-actions";
import type { testRemark } from "@/lib/supabase/test-cases";

// A remark that can be cited by a defect on this case: a step remark (label "Step 2") or overall feedback (stepText null).
export type defectCandidate = {
	remark: testRemark;
	label: string;
	stepText: string | null;
	files: signedAttachment[];
};

// Logs a defect against a failed test case, failed steps, or individual overall remarks. Nothing starts selected.
// Choosing the whole case disables the step and remark lists. The detail fields (precondition, steps,
// expected/actual) are filled in on the defect itself afterwards.
export function CreateDefectDialog({ caseResultId, caseCode, caseTitle, candidates, onCreated }: {
	caseResultId: string;
	caseCode?: string | null;
	caseTitle?: string | null;
	onCreated?: () => void;
	candidates: defectCandidate[];
}) {
	const [open, setOpen] = useState(false);
	const [summary, setSummary] = useState("");
	const [severity, setSeverity] = useState<defectSeverity>("medium");
	const [externalUrl, setExternalUrl] = useState("");
	const [urlTouched, setUrlTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [remarkIds, setRemarkIds] = useState<string[]>([]);
	const [caseSelected, setCaseSelected] = useState(false);
	// The round the defect is logged in, loaded when the dialog opens.
	const [round, setRound] = useState<{ iterationId: string } | null>(null);
	const [roundError, setRoundError] = useState<string | null>(null);
	// One option per failed step, holding every remark on it.
	const steps = candidates.filter((c) => c.stepText !== null).reduce<{ key: string; label: string; name: string; ids: string[]; remarks: testRemark[] }[]>((groups, c) => {
		const key = `${c.label}|${c.stepText}`;
		const group = groups.find((g) => g.key === key);
		if (group) { group.ids.push(c.remark.id); group.remarks.push(c.remark); }
		else groups.push({ key, label: c.label, name: c.stepText ?? "", ids: [c.remark.id], remarks: [c.remark] });
		return groups;
	}, []);
	const overall = candidates.filter((c) => c.stepText === null);
	const selectedCount = caseSelected ? 1 : remarkIds.length;
	const urlError = externalUrlError(externalUrl);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		getRoundFailedCases(caseResultId).then((res) => {
			if (cancelled) return;
			if (res.ok) setRound(res.data);
			else setRoundError(res.error);
		});
		return () => { cancelled = true; };
	}, [open, caseResultId]);

	function reset() {
		setRemarkIds([]);
		setCaseSelected(false);
		setSummary("");
		setSeverity("medium");
		setExternalUrl("");
		setUrlTouched(false);
		setError(null);
		setRoundError(null);
	}

	function onSave() {
		if (!round) return;
		setError(null);
		startTransition(async () => {
			const result = await createDefect({
				iterationId: round.iterationId,
				summary,
				precondition: "",
				stepsToReproduce: "",
				expectedResult: "",
				actualResult: "",
				severity,
				remarkIds: caseSelected ? [] : remarkIds,
				caseResultIds: caseSelected ? [caseResultId] : [],
				externalRefs: externalUrl.trim() ? [{ label: "", url: externalUrl }] : [],
			});
			if (!result.ok) {
				setError(result.error);
				return;
			}
			toast.success(`${result.data.code} logged`);
			onCreated?.();
			reset();
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
			<DialogTrigger render={<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
				<Bug className="size-3.5" />
				Create defect
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Bug className="size-4" />
						Create defect
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Logged against this round. Add the precondition, steps and results on the defect afterwards. Staff only; clients don&apos;t see defects.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					<div className="flex flex-col gap-1">
						<Label htmlFor="defect-summary" className="text-xs text-muted-foreground flex flex-row justify-between">
							<span>Summary</span>
							<span className="text-destructive text-xs">*</span>
						</Label>
						<Input id="defect-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} disabled={isPending} placeholder="e.g. Save button does nothing on the profile page" />
					</div>
					<ScrollArea className="w-full max-w-full rounded-md border [&>[data-slot=scroll-area-viewport]]:max-h-72">
						<div className="flex w-0 min-w-full flex-col gap-3 p-2 pr-3">
							<ItemSection title="Failed test case">
								<ItemRow title={[caseCode, caseTitle].filter(Boolean).join(": ") || "This test case"} badgeClass={SEVERITY_CLASSNAMES.critical} badge="Failed test case" added={caseSelected} disabled={isPending}
									onToggle={() => { setCaseSelected((v) => !v); setRemarkIds([]); }} />
							</ItemSection>
							<ItemSection title="Failed steps" empty={steps.length === 0 ? "No failed steps." : undefined}>
								{steps.map((g) => {
									const added = g.ids.every((id) => remarkIds.includes(id));
									return <ItemRow key={g.key} title={`${g.label}: ${g.name}`} badge="Failed step" badgeClass={SEVERITY_CLASSNAMES.critical} sub={`${g.ids.length} remark${g.ids.length === 1 ? "" : "s"}`} added={added} disabled={isPending || caseSelected}
										onToggle={() => setRemarkIds((ids) => (added ? ids.filter((id) => !g.ids.includes(id)) : [...new Set([...ids, ...g.ids])]))}>
										{g.remarks.map((r) => {
											const remarkAdded = remarkIds.includes(r.id);
											return <ItemRow key={r.id} title={r.remark} badge="Step remark" badgeClass={SEVERITY_CLASSNAMES.critical} author={authorOf(r)} added={remarkAdded} disabled={isPending || caseSelected}
												onToggle={() => setRemarkIds((ids) => (remarkAdded ? ids.filter((id) => id !== r.id) : [...ids, r.id]))} />;
										})}
									</ItemRow>;
								})}
							</ItemSection>
							<ItemSection title="Overall remarks" empty={overall.length === 0 ? "No overall remarks." : undefined}>
								{overall.map((c) => {
									const added = remarkIds.includes(c.remark.id);
									return <ItemRow key={c.remark.id} title={c.remark.remark} badge="Overall remark" author={authorOf(c.remark)} added={added} disabled={isPending || caseSelected}
										onToggle={() => setRemarkIds((ids) => (added ? ids.filter((id) => id !== c.remark.id) : [...ids, c.remark.id]))} />;
								})}
							</ItemSection>
						</div>
					</ScrollArea>
					{roundError && <p className="text-xs text-destructive">{roundError}</p>}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-1">
							<Label className="text-xs text-muted-foreground">Severity</Label>
							<Select value={severity} onValueChange={(value) => value && setSeverity(value as defectSeverity)} disabled={isPending}>
								<SelectTrigger className="w-full">
									<SelectValue>{DEFECT_SEVERITIES.find((s) => s.value === severity)?.label}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{DEFECT_SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="defect-external" className="text-xs text-muted-foreground">External link</Label>
							<Input id="defect-external" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} onBlur={() => setUrlTouched(true)} disabled={isPending} placeholder="https://yourteam.atlassian.net/browse/ABC-123" aria-invalid={urlTouched && !!urlError} />
							{urlTouched && urlError && <p className="text-xs text-destructive">{urlError}</p>}
						</div>
					</div>
					{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Cancel
					</DialogClose>
					<Button onClick={onSave} disabled={isPending || !round || selectedCount === 0 || !summary.trim() || !!urlError}>
						<Bug className="size-4" />
						{isPending ? "Saving…" : "Create defect"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ItemSection({ title, empty, children }: { title: string; empty?: string; children?: React.ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p className="text-xs font-medium text-muted-foreground">{title}</p>
			{empty ? <p className="text-xs text-muted-foreground">{empty}</p> : <ul className="flex min-w-0 flex-col gap-1">{children}</ul>}
		</div>
	);
}


// "Jane Doe · Action Officer" for a remark, when its author is known.
export const authorOf = (r: testRemark) => (r.author ? ([r.author.full_name, r.roleName] as [string, string?]) : undefined);

// A row with an Add toggle. Rows given children (failed steps, with their remarks) also get a collapsed-by-default dropdown.
export function ItemRow({ author, title, badge, badgeClass, sub, added, disabled, onToggle, defaultExpanded = false, children }: {
	author?: [string, string?]; title: string; badge: string; badgeClass?: string; sub?: string; added: boolean; disabled: boolean; onToggle: () => void;
	defaultExpanded?: boolean;
	children?: React.ReactNode;
}) {
	const [expanded, setExpanded] = useState(defaultExpanded);
	return (
		<li className={cn("flex min-w-0 max-w-full flex-col gap-1 overflow-hidden rounded-md border px-3 py-2", added && "bg-muted/40", disabled && "opacity-50")}>
			<div className={`flex min-w-0 flex-row gap-2 ${author || sub ? "items-start" : "items-center"}`}>
				<div className="flex flex-row gap-1">

					{
						children ?
							<Button variant="outline" size="icon-xs" className="h-6 shrink-0 gap-1 px-2 text-xs" aria-expanded={expanded} aria-label={expanded ? "Hide remarks" : "Show remarks"} onClick={() => setExpanded((v) => !v)}>
								<ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
							</Button>
							: null
					}
					<Button variant={added ? "secondary" : "outline"} size="icon-xs" className="h-6 shrink-0 gap-1 px-2 text-xs" disabled={disabled} onClick={onToggle}>
						{added ? <Check className="size-3" /> : <Plus className="size-3" />}
					</Button>
				</div>
				{
					author ?
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<div className="flex flex-row justify-between min-w-0 flex-1">
								<p className="break-all text-xs font-semibold">{author[0]}{author[1] ? ` · ${author[1]}` : ""}</p>
								<Badge variant="outline" className={cn("h-4 px-1.5 text-[10px]", badgeClass ?? "text-muted-foreground")}>{badge}</Badge>
							</div>
							<div className="">
								<p className="text-xs text-muted-foreground" title={title}>{title}</p>
							</div>
						</div>
						:
						<div className="flex min-w-0 flex-1 flex-row justify-between">
							<div className="">
								<p className="break-all text-xs font-semibold" title={title}>{title}</p>
								{
									sub && <p className="text-xs text-muted-foreground">{sub}</p>
								}
							</div>
							<Badge variant="outline" className={cn("h-4 px-1.5 text-[10px]", badgeClass ?? "text-muted-foreground")}>{badge}</Badge>
						</div>
				}

			</div>
			{children && expanded && <ul className="ml-3 flex min-w-0 flex-col gap-1 border-l pl-4">{children}</ul>}
		</li>
	);
}
