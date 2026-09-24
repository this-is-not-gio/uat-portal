"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Lock, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { applyIterationSync, forceRefreshCaseResult, getSyncDiff, type caseContent } from "@/lib/supabase/sync-actions";
import type { iterationChange } from "@/lib/supabase/test-iterations";

function changeKey(change: iterationChange): string {
	return `${change.change}:${change.testCaseResultId ?? change.testCaseId}`;
}

// Banner + dialog on the vendor's Test Cases tab while a round is running.
export default function SyncBanner({ iteration, changes }: { iteration: { id: string; name: string }; changes: iterationChange[] }) {
	const [open, setOpen] = useState(false);
	const selectable = changes.filter((c) => !c.hasResults);
	const [selected, setSelected] = useState<Set<string>>(() => new Set(selectable.map(changeKey)));
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	if (changes.length === 0) return null;

	const groups: { title: string; hint?: string; rows: iterationChange[]; locked: boolean }[] = [
		{ title: "Added", hint: "New test cases, added to the round as Untested", rows: changes.filter((c) => c.change === "added"), locked: false },
		{ title: "Changed — not tested yet", hint: "Refreshed in place, nothing is lost", rows: changes.filter((c) => c.change === "changed" && !c.hasResults), locked: false },
		{ title: "Changed — already tested", hint: "Results are kept; the new version is tested next round", rows: changes.filter((c) => c.change === "changed" && c.hasResults), locked: true },
		{ title: "Removed — not tested yet", hint: "Dropped from the round", rows: changes.filter((c) => c.change === "removed" && !c.hasResults), locked: false },
		{ title: "Removed — already tested", hint: "Stays in this round's results", rows: changes.filter((c) => c.change === "removed" && c.hasResults), locked: true },
	];

	function toggle(key: string) {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key); else next.add(key);
			return next;
		});
	}

	function onSync() {
		const chosen = selectable.filter((c) => selected.has(changeKey(c)));
		setError(null);
		startTransition(async () => {
			const result = await applyIterationSync({
				iterationId: iteration.id,
				add: chosen.filter((c) => c.change === "added").map((c) => c.testCaseId!),
				refreshIds: chosen.filter((c) => c.change === "changed").map((c) => c.testCaseResultId!),
				remove: chosen.filter((c) => c.change === "removed").map((c) => c.testCaseResultId!),
			});
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	const selectedCount = selectable.filter((c) => selected.has(changeKey(c))).length;

	return (
		<div className="flex flex-row items-center justify-between gap-2 rounded-md border border-amber-600/40 bg-amber-50 px-4 py-3">
			<div className="flex flex-row items-center gap-2 text-amber-900">
				<TriangleAlert className="size-4" />
				<p className="text-sm">
					<span className="font-semibold">{changes.length} change{changes.length === 1 ? "" : "s"}</span> aren&apos;t in {iteration.name} yet
				</p>
			</div>
			<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setSelected(new Set(selectable.map(changeKey))); setError(null); } }}>
				<DialogTrigger render={
					<Button size="sm" variant="outline">
						<RefreshCw className="h-3.5 w-3.5" /> Review &amp; sync
					</Button>
				} />
				<DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Sync changes into {iteration.name}</DialogTitle>
						<DialogDescription>Only the selected changes reach testers. Already-tested rows are never reset by sync.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{groups.filter((g) => g.rows.length > 0).map((group) => (
							<div key={group.title} className="flex flex-col gap-1">
								<div className="flex flex-row items-baseline gap-2">
									<p className="text-xs font-semibold uppercase tracking-wide">{group.title} ({group.rows.length})</p>
									{group.hint && <p className="text-xs text-muted-foreground">{group.hint}</p>}
								</div>
								{group.rows.map((change) => (
									<ChangeRow
										key={changeKey(change)}
										change={change}
										locked={group.locked}
										checked={selected.has(changeKey(change))}
										onToggle={() => toggle(changeKey(change))}
										disabled={isPending}
									/>
								))}
							</div>
						))}
						{error && <p className="text-xs text-destructive">{error}</p>}
					</div>
					<DialogFooter>
						<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
						<Button onClick={onSync} disabled={isPending || selectedCount === 0}>
							{isPending ? "Syncing…" : `Sync ${selectedCount}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ChangeRow({ change, locked, checked, onToggle, disabled }: { change: iterationChange; locked: boolean; checked: boolean; onToggle: () => void; disabled: boolean }) {
	const [showDiff, setShowDiff] = useState(false);
	const canDiff = change.change === "changed";

	return (
		<div className="rounded-md border">
			<div className="flex flex-row items-center gap-2 px-3 py-2">
				{locked ? (
					<Lock className="size-3.5 text-muted-foreground" />
				) : (
					<input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={onToggle} disabled={disabled} aria-label={`Sync ${change.code ?? change.title}`} />
				)}
				<span className="font-mono text-xs">{change.code}</span>
				<span className="text-sm truncate flex-1">{change.title}</span>
				{locked && <Badge variant="outline" className="text-xs">{change.change === "changed" ? "Retest next round" : "Kept in round"}</Badge>}
				{canDiff && (
					<Button size="sm" variant="ghost" onClick={() => setShowDiff((v) => !v)}>
						{showDiff ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} View changes
					</Button>
				)}
				{locked && change.change === "changed" && change.testCaseResultId && (
					<ForceRefreshButton caseResultId={change.testCaseResultId} label={change.code ?? change.title} />
				)}
			</div>
			{showDiff && change.testCaseResultId && <SyncDiff caseResultId={change.testCaseResultId} />}
		</div>
	);
}

function SyncDiff({ caseResultId }: { caseResultId: string }) {
	const [diff, setDiff] = useState<{ before: caseContent; after: caseContent } | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Fetched on expand only; most rows are never opened.
	useEffect(() => {
		let cancelled = false;
		getSyncDiff({ caseResultId }).then((result) => {
			if (cancelled) return;
			if (result.ok) setDiff(result.data); else setError(result.error);
		});
		return () => { cancelled = true; };
	}, [caseResultId]);

	if (error) return <p className="px-3 pb-3 text-xs text-destructive">{error}</p>;
	if (!diff) return <p className="px-3 pb-3 text-xs text-muted-foreground">Loading changes…</p>;

	const { before, after } = diff;
	const fields: [string, string | null, string | null][] = [
		["Title", before.title, after.title],
		["Section", before.section, after.section],
		["Priority", before.priority, after.priority],
		["Role", before.roleAssignee, after.roleAssignee],
	];
	const stepText = (s: caseContent["steps"][number]) => `${s.step}${s.expected.length ? ` → ${s.expected.join("; ")}` : ""}`;

	return (
		<div className="grid grid-cols-[6rem_1fr_1fr] gap-x-3 gap-y-1 border-t px-3 py-2 text-xs">
			<span />
			<span className="font-semibold text-muted-foreground">In this round</span>
			<span className="font-semibold text-muted-foreground">Live now</span>
			{fields.filter(([, b, a]) => b !== a).map(([label, b, a]) => (
				<DiffLine key={label} label={label} before={b ?? "—"} after={a ?? "—"} />
			))}
			<DiffList label="Preconditions" before={before.preconditions} after={after.preconditions} />
			<DiffList label="Steps" before={before.steps.map(stepText)} after={after.steps.map(stepText)} />
		</div>
	);
}

function DiffLine({ label, before, after }: { label: string; before: string; after: string }) {
	return (
		<>
			<span className="text-muted-foreground">{label}</span>
			<span className="bg-red-50 text-red-900 rounded px-1 line-through decoration-red-400/60">{before}</span>
			<span className="bg-green-50 text-green-900 rounded px-1">{after}</span>
		</>
	);
}

function DiffList({ label, before, after }: { label: string; before: string[]; after: string[] }) {
	if (before.join("\n") === after.join("\n")) return null;
	const rows = Math.max(before.length, after.length);
	return (
		<>
			{Array.from({ length: rows }, (_, i) => {
				const b = before[i];
				const a = after[i];
				const same = b === a;
				return (
					<div key={`${label}-${i}`} className="contents">
						<span className="text-muted-foreground">{i === 0 ? label : ""}</span>
						<span className={cn("rounded px-1", !same && b !== undefined && "bg-red-50 text-red-900 line-through decoration-red-400/60")}>{b ?? ""}</span>
						<span className={cn("rounded px-1", !same && a !== undefined && "bg-green-50 text-green-900")}>{a ?? ""}</span>
					</div>
				);
			})}
		</>
	);
}

function ForceRefreshButton({ caseResultId, label }: { caseResultId: string; label: string }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onConfirm() {
		setError(null);
		startTransition(async () => {
			const result = await forceRefreshCaseResult({ caseResultId, reason: reason.trim() });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setReason(""); setError(null); } }}>
			<DialogTrigger render={<Button size="sm" variant="ghost" className="text-destructive">Force refresh…</Button>} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Force refresh {label}?</DialogTitle>
					<DialogDescription>
						Use this only when the tested version was wrong (e.g. a bad expected result). Its results and remarks are archived, and the row goes back to Untested with the new version.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="force-reason">Reason (shown to testers)</Label>
					<Textarea id="force-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Expected result for step 2 was wrong" disabled={isPending} />
					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button variant="destructive" onClick={onConfirm} disabled={isPending || !reason.trim()}>
						{isPending ? "Refreshing…" : "Archive results & refresh"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
