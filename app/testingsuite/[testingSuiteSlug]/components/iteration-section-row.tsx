"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { applyIterationSync } from "@/lib/supabase/sync-actions";
import ConfirmDialog from "./confirm-dialog";

// Hover-reveal "Remove section" for a section already snapshotted into an
// iteration — the inverse of AddTestCasesControl/SectionDialog's "add to
// iteration". Removing is just apply_iteration_sync's `remove` argument with
// this section's own result ids; the DB rejects any that already have
// recorded results, same rule cancel_iteration/remove_case_result enforce
// elsewhere, so a partially-tested section's attempt just surfaces that
// error instead of silently doing nothing.
export default function IterationSectionRow({
	iterationId,
	sectionName,
	resultIds,
	children,
}: {
	iterationId: string;
	sectionName: string;
	resultIds: string[];
	children: React.ReactNode;
}) {
	const [hovered, setHovered] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	return (
		<SidebarMenuItem onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
			{children}
			<div
				data-sidebar="menu-action"
				className={cn(
					"absolute top-1.5 right-1 flex flex-row items-center gap-0.5 transition-opacity",
					hovered ? "opacity-100" : "opacity-0"
				)}
			>
				<Tooltip>
					<TooltipTrigger render={
						<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setDeleteOpen(true)} aria-label={`Remove ${sectionName} from this iteration`}>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					} />
					<TooltipContent>Remove section from iteration</TooltipContent>
				</Tooltip>
			</div>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Remove ${sectionName} from this iteration?`}
				description="Only works while none of its test cases have recorded results yet — otherwise they stay as history."
				confirmLabel="Remove section"
				onConfirm={() => applyIterationSync({ iterationId, add: [], refreshIds: [], remove: resultIds })}
			/>
		</SidebarMenuItem>
	);
}
