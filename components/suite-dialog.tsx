"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, FolderPlus, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { updateExitCriteria, upsertSuite } from "@/lib/supabase/authoring-actions";
import { DEFAULT_EXIT_CRITERIA, exitCriteriaError, sameExitCriteria, type ExitCriteria } from "@/lib/report/exit-criteria";
import { ExitCriteriaFields } from "@/app/testingsuite/[testingSuiteSlug]/components/exit-criteria-card";

type suiteFields = { id: string; name: string; code: string | null; slug: string; description: string; status: string };

// Create a testing suite (starts as Draft) or edit an existing one. Pass a
// trigger, or open/onOpenChange when it's opened from a menu (SuiteHeaderMenu).
// Both also set the exit criteria the sign-off report's verdict is measured
// against (new suites start from the defaults); they lock once the suite is past
// Ready (the lock_exit_criteria trigger).
export default function SuiteDialog({ suite, exitCriteria, trigger, open: controlledOpen, onOpenChange }: { suite?: suiteFields; exitCriteria?: ExitCriteria; trigger?: React.ReactElement; open?: boolean; onOpenChange?: (open: boolean) => void }) {
	const router = useRouter();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [name, setName] = useState(suite?.name ?? "");
	const [code, setCode] = useState(suite?.code ?? "");
	const [description, setDescription] = useState(suite?.description ?? "");
	const initialCriteria = exitCriteria ?? DEFAULT_EXIT_CRITERIA;
	const [criteria, setCriteria] = useState(initialCriteria);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const isEdit = !!suite;
	const criteriaLocked = !!suite && suite.status !== "draft" && suite.status !== "ready";

	function reset() {
		setName(suite?.name ?? "");
		setCode(suite?.code ?? "");
		setDescription(suite?.description ?? "");
		setCriteria(initialCriteria);
		setError(null);
	}

	function onSave() {
		setError(null);
		const criteriaChanged = !criteriaLocked && !sameExitCriteria(criteria, initialCriteria);
		const invalid = criteriaChanged ? exitCriteriaError(criteria) : null;
		if (invalid) {
			setError(invalid);
			return;
		}
		startTransition(async () => {
			if (suite && criteriaChanged) {
				const criteriaResult = await updateExitCriteria({ suiteId: suite.id, criteria });
				if (!criteriaResult.ok) {
					setError(criteriaResult.error);
					return;
				}
			}
			const result = await upsertSuite({ id: suite?.id, name: name.trim(), code: code.trim(), description });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			// A new suite gets its criteria once it exists. Validated above, so this
			// rarely fails; if it does the suite keeps the defaults, editable from its menu.
			if (!suite && criteriaChanged) await updateExitCriteria({ suiteId: result.data.id, criteria });
			setOpen(false);
			if (!isEdit) router.push(`/testingsuite/${result.data.slug}?tab=overview`);
			// A rename may give the suite a new slug, so leave the old URL behind.
			else if (result.data.slug !== suite.slug) router.replace(`/testingsuite/${result.data.slug}?tab=overview`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(); }}>
			{trigger && <DialogTrigger render={trigger} />}
			<DialogContent className="sm:max-w-xl">
				<DialogHeader className="flex flex-col px-2 pt-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						{isEdit ? <Pencil className="size-4" /> : <FolderPlus className="size-4" />}
						{isEdit ? "Edit testing suite" : "New testing suite"}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{isEdit ? "Changes apply to the live suite." : "The suite starts as a Draft, hidden from testers until it's marked ready."}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					<div className="flex flex-col gap-1">
						<Label htmlFor="suite-name" className="text-xs text-muted-foreground">Testing Suite Name</Label>
						<Input id="suite-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="suite-code" className="text-xs text-muted-foreground flex flex-row justify-between">
							 <span>Code</span>
							 <span className="text-muted-foreground text-xs">(optional, prefixes test case codes e.g. LCI-001)</span></Label>
						<Input id="suite-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={isPending} />
					</div>
					<div className="flex flex-col gap-3">
						<div className="flex flex-col">
							<p className="text-sm font-semibold">Exit criteria</p>
							{criteriaLocked ? (
								<p className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
									<Lock className="size-3" />
									Locked once testing starts
								</p>
							) : (
								<p className="text-xs text-muted-foreground">The sign-off report&apos;s verdict is measured against these.</p>
							)}
						</div>
						<ExitCriteriaFields value={criteria} onChange={setCriteria} disabled={isPending || criteriaLocked} />
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<div className="flex flex-row gap-2">
						<DialogClose render={<Button variant="outline" disabled={isPending} />}>
							Cancel
						</DialogClose>
						<Button onClick={onSave} disabled={isPending || !name.trim()}>
							<Plus className="size-4" />
							{isPending ? "Saving…" : isEdit ? "Save" : "Create suite"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
