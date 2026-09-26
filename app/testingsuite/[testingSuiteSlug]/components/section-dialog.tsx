"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, FolderPlus, X, Check, Plus } from "lucide-react";
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
import { upsertSection } from "@/lib/supabase/authoring-actions";
import { applyIterationSync } from "@/lib/supabase/sync-actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

type notIncludedSection = { id: string; name: string; slug: string; testCasesLength: number; testCaseIds: string[] };

// Create a section (then open it) or rename an existing one. Pass `trigger`
// for an uncontrolled dialog, or `open`/`onOpenChange` to drive it from a menu.
// When opened from an iteration's own menu, `iterationId`/`sectionsNotIncluded`
// add a second, separate action: pick existing sections the round doesn't
// have yet and sync their complete test cases straight into it.
export default function SectionDialog({
	suiteId,
	testSuiteSlug,
	section,
	trigger,
	open: controlledOpen,
	onOpenChange,
	sectionsNotIncluded,
	iterationId,
}: {
	suiteId: string;
	testSuiteSlug: string;
	section?: { id: string; name: string };
	trigger?: React.ReactElement;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	sectionsNotIncluded?: notIncludedSection[];
	iterationId?: string;
}) {
	const router = useRouter();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [name, setName] = useState(section?.name ?? "");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const isRename = !!section;

	const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
	const [syncError, setSyncError] = useState<string | null>(null);
	const [isSyncPending, startSyncTransition] = useTransition();

	function toggleSection(id: string, checked: boolean) {
		setSelectedSectionIds((previous) => {
			const next = new Set(previous);
			if (checked) next.add(id); else next.delete(id);
			return next;
		});
	}

	const selectedSections = (sectionsNotIncluded ?? []).filter((s) => selectedSectionIds.has(s.id));
	const addableCount = selectedSections.reduce((sum, s) => sum + s.testCaseIds.length, 0);

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await upsertSection({ suiteId, id: section?.id, name: name.trim() });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			if (!isRename) {
				setName("");
				router.push(`/testingsuite/${testSuiteSlug}/${result.data.slug}?tab=test-cases`);
			}
		});
	}

	function onAddToIteration() {
		if (!iterationId) return;
		setSyncError(null);
		startSyncTransition(async () => {
			const testCaseIds = selectedSections.flatMap((s) => s.testCaseIds);
			const result = await applyIterationSync({ iterationId, add: testCaseIds, refreshIds: [], remove: [] });
			if (!result.ok) {
				setSyncError(result.error);
				return;
			}
			setSelectedSectionIds(new Set());
			setOpen(false);
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setName(section?.name ?? "");
					setSelectedSectionIds(new Set());
				}
				setError(null);
				setSyncError(null);
			}}
		>
			{trigger && <DialogTrigger render={trigger} />}
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						{isRename ? <Pencil className="size-4" /> : <FolderPlus className="size-4" />}
						{isRename ? "Rename Testing Section" : "Add a Section"}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{isRename
							? "The new name shows everywhere, including rounds that haven't been synced yet."
							: sectionsNotIncluded
								? "Create a brand-new section, or add an existing one straight into this iteration."
								: "Sections group related test cases, e.g. \"Login and Authentication\"."}
					</DialogDescription>
				</DialogHeader>
				{sectionsNotIncluded && (
					<div className="flex flex-col gap-2 px-2 py-1">
						<p className="text-xs text-muted-foreground">Existing sections not yet in this iteration</p>
						<ScrollArea className="border rounded-md bg-gray-50/30 max-h-40">
							<div className="flex gap-2 flex-col p-2">
								{sectionsNotIncluded.length > 0 ? sectionsNotIncluded.map((s) => (
									<label key={s.id} className="flex items-center gap-2 p-2 rounded-md bg-gray-50/30 border cursor-pointer">
										<Checkbox
											checked={selectedSectionIds.has(s.id)}
											onCheckedChange={(checked) => toggleSection(s.id, checked === true)}
											disabled={isSyncPending}
										/>
										<div className="flex flex-row items-center justify-between gap-2 w-full">
											<p className="text-xs font-medium">{s.name}</p>
											<p className="text-xs text-muted-foreground font-mono">{s.testCasesLength} test cases</p>
										</div>
									</label>
								)) : (
									<p className="text-xs text-muted-foreground">Every section in this suite is already in this round.</p>
								)}
							</div>
						</ScrollArea>
					</div>
				)}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending || isSyncPending} />}>
						<X className="size-4" />
						Close
					</DialogClose>
					{selectedSections.length > 0 ? (
						<Button onClick={onAddToIteration} disabled={isSyncPending || addableCount === 0}>
							<Check className="size-4" />
							{isSyncPending ? "Adding…" : selectedSections.length === 1 ? `Add ${selectedSections.length} Section to iteration` : `Add ${selectedSections.length} Sections to iteration`}
						</Button>
					) : (
						<Button onClick={onSave} disabled={isPending || name.trim().length === 0}>
							<Plus className="size-4" />
							{isPending ? "Saving…" : isRename ? "Rename" : "Create"}
						</Button>
					)}
					{syncError && <p className="text-xs text-destructive">{syncError}</p>}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
} 
			