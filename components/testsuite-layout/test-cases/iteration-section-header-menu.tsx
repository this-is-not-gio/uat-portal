"use client";

import { testCasesHref } from "./href";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FolderMinus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { applyIterationSync } from "@/lib/supabase/sync-actions";
import ConfirmDialog from "@/components/confirm-dialog";

// The "more" menu on a round's section header (TestIterationSection). Withdrawing
// is apply_iteration_sync's `remove` with this section's result ids — the same as
// IterationSectionRow's sidebar action. The dialog sits outside the menu so it
// stays open after the menu closes.
export default function IterationSectionHeaderMenu({
	iteration,
	sectionName,
	resultIds,
}: {
	iteration: testIteration;
	sectionName: string;
	resultIds: string[];
}) {
	const router = useRouter();
	const { testSuiteSlug } = useParams<{ testSuiteSlug: string }>();
	const [withdrawOpen, setWithdrawOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="icon" variant="outline" className="text-xs">
					<MoreVertical size={14} />
				</Button>} />
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem variant="destructive" className="text-xs" onClick={() => setWithdrawOpen(true)}>
						<FolderMinus size={14} />
						<span>Withdraw Section</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ConfirmDialog
				open={withdrawOpen}
				onOpenChange={setWithdrawOpen}
				title={`Withdraw ${sectionName} from ${iteration.name}?`}
				description="Its test cases are taken out of this round for every participant. The section stays in the suite and can be added back before the round starts."
				confirmLabel="Withdraw section"
				onConfirm={() => applyIterationSync({ iterationId: iteration.id, add: [], refreshIds: [], remove: resultIds })}
				// The section's page in this round no longer exists; go back to the round.
				onDone={() => router.replace(testCasesHref(testSuiteSlug, iteration.slug))}
			/>
		</>
	);
}
