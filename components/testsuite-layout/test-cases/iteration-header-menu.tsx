"use client";

import { testCasesHref } from "./href";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MoreVertical, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { cancelIteration, resetIteration } from "@/lib/supabase/iteration-actions";
import EditIterationDialog from "./edit-iteration-dialog";
import ConfirmDialog from "@/components/confirm-dialog";

// The "more" menu on the round header (TestIterationComponent). The dialogs sit
// outside the menu so they stay open after the menu closes.
export default function IterationHeaderMenu({ iteration }: { iteration: testIteration }) {
	const router = useRouter();
	const { testSuiteSlug } = useParams<{ testSuiteSlug: string }>();
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="icon-lg" variant="outline" className="shrink-0 text-xs">
					<MoreVertical size={14} />
				</Button>} />
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem className="text-xs" onClick={() => setEditOpen(true)}>
						<Pencil size={14} />
						<span>Edit Iteration</span>
					</DropdownMenuItem>
					{
						iteration.status === "not_started" ?
							<DropdownMenuItem variant="destructive" className="text-xs" onClick={() => setDeleteOpen(true)}>
								<Trash2 size={14} />
								<span>Delete Iteration</span>
							</DropdownMenuItem>
						: iteration.status === "in_progress" ?
							<DropdownMenuItem variant="destructive" className="text-xs" onClick={() => setResetOpen(true)}>
								<RotateCcw size={14} />
								<span>Cancel Iteration</span>
							</DropdownMenuItem>
						: null
					}
				</DropdownMenuContent>
			</DropdownMenu>
			<EditIterationDialog iteration={iteration} open={editOpen} onOpenChange={setEditOpen} />
			{/* cancel_iteration hard-deletes a round with no recorded results (a planned one never has any). */}
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete ${iteration.name}?`}
				description="This round hasn't started, so it is deleted along with its participants and copied test cases, as if it was never planned. This can't be undone."
				confirmLabel="Delete iteration"
				onConfirm={() => cancelIteration({ iterationId: iteration.id })}
				// The round's page no longer exists; go back to the suite's test cases.
				onDone={() => router.replace(testCasesHref(testSuiteSlug, "all"))}
			/>
			{/* reset_iteration (0029): back to not_started, keeping participants and cases. */}
			<ConfirmDialog
				open={resetOpen}
				onOpenChange={setResetOpen}
				title={`Cancel ${iteration.name}?`}
				description="The round goes back to Not Started with the same participants and test cases. Every recorded step and case status, remark and organization submission is erased. This can't be undone."
				confirmLabel="Cancel iteration"
				onConfirm={() => resetIteration({ iterationId: iteration.id })}
			/>
		</>
	);
}
