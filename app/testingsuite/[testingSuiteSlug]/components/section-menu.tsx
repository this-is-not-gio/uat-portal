"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteSection } from "@/lib/supabase/authoring-actions";
import { cn } from "@/lib/utils";
import SectionDialog from "./section-dialog";
import ConfirmDialog from "./confirm-dialog";

// Per-section actions in the Test Cases sidebar: edit, delete. Visibility is
// driven by `visible` (the row's own hover state), not CSS group-hover — that
// scoped incorrectly and revealed every row's actions at once. The drag
// handle lives on the section's own icon in SectionLeaf, not here.
export default function SectionMenu({
	suiteId,
	testSuiteSlug,
	section,
	testCaseCount,
	visible,
}: {
	suiteId: string;
	testSuiteSlug: string;
	section: { id: string; name: string };
	testCaseCount: number;
	visible: boolean;
}) {
	const router = useRouter();
	const [renameOpen, setRenameOpen] = useState(false);
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
						<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setRenameOpen(true)} aria-label={`Edit ${section.name}`}>
							<Pencil className="h-3.5 w-3.5" />
						</Button>
					} />
					<TooltipContent>Edit section</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setDeleteOpen(true)} aria-label={`Delete ${section.name}`}>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					} />
					<TooltipContent>Delete section</TooltipContent>
				</Tooltip>
			</div>
			<SectionDialog suiteId={suiteId} testSuiteSlug={testSuiteSlug} section={section} open={renameOpen} onOpenChange={setRenameOpen} />
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete "${section.name}"?`}
				description={testCaseCount > 0
					? `Its ${testCaseCount} test case${testCaseCount === 1 ? "" : "s"} will be deleted too. Rounds that already copied them keep their results.`
					: "This section has no test cases."}
				confirmLabel="Delete section"
				onConfirm={() => deleteSection({ sectionId: section.id })}
				onDone={() => router.push(`/testingsuite/${testSuiteSlug}/all?tab=test-cases`)}
			/>
		</>
	);
}
