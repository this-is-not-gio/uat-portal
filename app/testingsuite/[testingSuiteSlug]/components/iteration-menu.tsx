"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cancelIteration } from "@/lib/supabase/iteration-actions";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { cn } from "@/lib/utils";
import EditIterationDialog from "./edit-iteration-dialog";
import ConfirmDialog from "./confirm-dialog";
import SectionDialog from "./section-dialog";

// Per-iteration actions in the Test Iterations sidebar: add a section to the
// suite (same SectionDialog the Testing Suite tree uses — a section only
// ever lives on the live suite, an iteration just snapshots it later), edit
// this iteration's label/planned end date, delete it. Delete only actually
// works while the round is in_progress with nothing recorded yet — the DB
// enforces the same rule (cancel_iteration), so a completed/tested round's
// attempt just surfaces that error instead of silently doing nothing.
export default function IterationMenu({
	iteration,
	suiteId,
	testSuiteSlug,
	visible,
	sectionsNotIncluded,
}: {
	iteration: testIteration;
	suiteId: string;
	testSuiteSlug: string;
	visible: boolean;
	sectionsNotIncluded?: { id: string; name: string; slug: string; testCasesLength: number; testCaseIds: string[] }[];
}) {
	const [addSectionOpen, setAddSectionOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	return (
		<>
			<div
				data-sidebar="menu-action"
				className={cn(
					"absolute top-1.5 right-1 flex flex-row items-center gap-0.5 transition-opacity",
					visible ? "opacity-100" : "opacity-0"
				)}
			>
				<Tooltip>
					<TooltipTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setAddSectionOpen(true)} aria-label="Add a section">
							<Plus className="h-3.5 w-3.5" />
						</Button>
					} />
					<TooltipContent>Add a section</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setEditOpen(true)} aria-label={`Edit ${iteration.name}`}>
							<Pencil className="h-3.5 w-3.5" />
						</Button>
					} />
					<TooltipContent>Edit iteration</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setDeleteOpen(true)} aria-label={`Delete ${iteration.name}`}>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					} />
					<TooltipContent>Delete iteration</TooltipContent>
				</Tooltip>
			</div>
			<SectionDialog suiteId={suiteId} testSuiteSlug={testSuiteSlug} open={addSectionOpen} onOpenChange={setAddSectionOpen} sectionsNotIncluded={sectionsNotIncluded} iterationId={iteration.id} />
			<EditIterationDialog iteration={iteration} open={editOpen} onOpenChange={setEditOpen} />
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete ${iteration.name}?`}
				description="Only works while the round is running with nothing recorded yet — otherwise complete or sign off around it instead."
				confirmLabel="Delete iteration"
				onConfirm={() => cancelIteration({ iterationId: iteration.id })}
			/>
		</>
	);
}
