"use client";

import { useEffect, useState, useTransition } from "react";
import { Bug, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEVERITY_CLASSNAMES } from "./defect-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Logs a defect from a remark on a failed step or the overall feedback of a failed case. The source remark starts
// added; other remarks of the same case can be added or removed. Whole test cases aren't linked from here.
// The detail fields (precondition, steps, expected/actual) are filled in on the defect itself afterwards.
export function CreateDefectDialog({ caseResultId, source, candidates, onCreated }: {
	caseResultId: string;
	onCreated?: () => void;
	source: defectCandidate;
	candidates: defectCandidate[];
}) {
	const [open, setOpen] = useState(false);
	const [summary, setSummary] = useState("");
	const [severity, setSeverity] = useState<defectSeverity>("medium");
	const [externalUrl, setExternalUrl] = useState("");
	const [urlTouched, setUrlTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [remarkIds, setRemarkIds] = useState<string[]>([source.remark.id]);
	// The round the defect is logged in, loaded when the dialog opens.
	const [round, setRound] = useState<{ iterationId: string } | null>(null);
	const [roundError, setRoundError] = useState<string | null>(null);
	const allRemarks = [source, ...candidates.filter((c) => c.remark.id !== source.remark.id)];
	// One option per step (or the overall feedback), holding every remark on it.
	const steps = allRemarks.reduce<{ key: string; label: string; name: string; overall: boolean; ids: string[] }[]>((groups, c) => {
		const key = `${c.label}|${c.stepText ?? ""}`;
		const group = groups.find((g) => g.key === key);
		if (group) group.ids.push(c.remark.id);
		else groups.push({ key, label: c.label, name: c.stepText ?? "Overall feedback on this test case", overall: c.stepText === null, ids: [c.remark.id] });
		return groups;
	}, []);
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
		setRemarkIds([source.remark.id]);
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
				remarkIds,
				caseResultIds: [],
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
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
					<div className="flex flex-col gap-1">
						<p className="text-xs font-medium text-muted-foreground">Add items{remarkIds.length > 0 ? ` (${remarkIds.length} remark${remarkIds.length === 1 ? "" : "s"} added)` : ""}</p>
						<ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
							{steps.map((g) => {
								const added = g.ids.some((id) => remarkIds.includes(id));
								return (
									<li key={g.key} className={`flex flex-row items-center justify-between gap-2 rounded-md border px-2 py-1 ${added ? "bg-muted/40" : ""}`}>
										<div className="flex min-w-0 flex-col">
											<p className="truncate text-xs font-semibold" title={g.name}>{g.label}: {g.name}</p>
											<p className="flex flex-row items-center gap-1.5 text-xs text-muted-foreground">
												<Badge variant="outline" className={cn("h-4 px-1.5 text-[10px]", g.overall ? "text-muted-foreground" : SEVERITY_CLASSNAMES.critical)}>{g.overall ? "Overall remark" : "Failed step"}</Badge>
												{g.ids.length} remark{g.ids.length === 1 ? "" : "s"}
											</p>
										</div>
										<Button variant={added ? "secondary" : "outline"} size="sm" className="h-6 shrink-0 gap-1 px-2 text-xs" disabled={isPending} onClick={() => setRemarkIds((ids) => (added ? ids.filter((id) => !g.ids.includes(id)) : [...ids, ...g.ids]))}>
											{added ? <><Check className="size-3" />Added</> : <><Plus className="size-3" />Add</>}
										</Button>
									</li>
								);
							})}
						</ul>
					</div>
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
					<Button onClick={onSave} disabled={isPending || !round || !summary.trim() || !!urlError}>
						<Bug className="size-4" />
						{isPending ? "Saving…" : "Create defect"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
