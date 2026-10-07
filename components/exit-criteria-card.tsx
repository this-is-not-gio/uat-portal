"use client";

import { useState, useTransition } from "react";
import { ClipboardCheck, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { updateExitCriteria } from "@/lib/supabase/authoring-actions";
import type { ExitCriteria } from "@/lib/supabase/sign-off-report";

// Overview "Exit criteria": the bar the sign-off report's verdict is measured against.
// Editable by authors while the suite is draft/ready; the DB trigger locks it after that.
export function ExitCriteriaCard({ suiteId, criteria, canEdit, locked }: { suiteId: string; criteria: ExitCriteria; canEdit: boolean; locked: boolean }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(criteria);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function startEditing() {
		setDraft(criteria);
		setError(null);
		setEditing(true);
	}

	function save() {
		setError(null);
		startTransition(async () => {
			const result = await updateExitCriteria({ suiteId, criteria: draft });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setEditing(false);
		});
	}

	return (
		<div className="flex flex-col gap-2 w-full">
			<div className="flex flex-row gap-2 items-center justify-between w-full">
				<div className="flex flex-row gap-2 items-center">
					<ClipboardCheck className="text-accent-foreground size-4" />
					<p className="font-semibold">Exit criteria</p>
				</div>
				{locked ? (
					<p className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
						<Lock className="size-3" />
						Locked once testing starts
					</p>
				) : canEdit && !editing ? (
					<Button size="sm" variant="outline" className="flex flex-row gap-2 items-center" onClick={startEditing}>
						<Pencil className="size-4" />
						<p className="text-xs">Edit</p>
					</Button>
				) : (
					<p className="text-xs text-muted-foreground">The sign-off report&apos;s verdict is measured against these.</p>
				)}
			</div>
			<div className="border rounded-md p-4">
				{editing ? (
					<div className="flex flex-col gap-4">
						<ExitCriteriaFields value={draft} onChange={setDraft} disabled={isPending} />
						{error && <p className="text-xs text-destructive">{error}</p>}
						<div className="flex flex-row justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={isPending}>Cancel</Button>
							<Button type="button" onClick={save} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
						</div>
					</div>
				) : (
					<ul className="list-disc pl-5 flex flex-col gap-1 text-sm">
						<li>Pass rate at least <span className="font-mono">{criteria.minPassRate}%</span> (untested cases count against it)</li>
						<li>At most <span className="font-mono">{criteria.maxFailed}</span> failed</li>
						<li>At most <span className="font-mono">{criteria.maxBlocked}</span> blocked</li>
						{criteria.requireAllOrgsSubmitted && <li>Every participating organization submitted, in every round</li>}
					</ul>
				)}
			</div>
		</div>
	);
}

// The exit criteria inputs, shared by this card and the edit suite dialog.
export function ExitCriteriaFields({ value, onChange, disabled }: { value: ExitCriteria; onChange: (next: ExitCriteria) => void; disabled?: boolean }) {
	const numberField = (key: "minPassRate" | "maxFailed" | "maxBlocked", label: string, props: { max?: number; step?: number; suffix?: string }) => (
		<div className="flex flex-col gap-1.5"	>
			<Label htmlFor={`exit-${key}`} className="text-xs text-muted-foreground">{label}</Label>
			<InputGroup>
				<InputGroupInput
					id={`exit-${key}`}
					type="number"
					min={0}
					max={props.max}
					step={props.step ?? 1}
					className="font-mono"
					value={Number.isNaN(value[key]) ? "" : value[key]}
					onChange={(e) => onChange({ ...value, [key]: e.target.valueAsNumber })}
					disabled={disabled}
				/>
				{props.suffix && (
					<InputGroupAddon align="inline-end">
						<InputGroupText>{props.suffix}</InputGroupText>
					</InputGroupAddon>
				)}
			</InputGroup>
		</div>
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-3 gap-2">
				{numberField("minPassRate", "Minimum pass rate", { max: 100, step: 0.1, suffix: "%" })}
				{numberField("maxFailed", "Max failed", { suffix: "test cases" })}
				{numberField("maxBlocked", "Max blocked", { suffix: "test cases" })}
			</div>
			<Label className="flex flex-row items-start font-normal text-xs">
				<Checkbox
					checked={value.requireAllOrgsSubmitted}
					onCheckedChange={(checked) => onChange({ ...value, requireAllOrgsSubmitted: checked })}
					disabled={disabled}
				/>
				<div className="">
					<p className="font-semibold text-sm">All organizations must submit</p>
					<p className="text-xs text-muted-foreground">Results aren&apos;t final while any organization testing the suite hasn&apos;t submitted yet.</p>
				</div>
			</Label>
		</div>
	);
}
