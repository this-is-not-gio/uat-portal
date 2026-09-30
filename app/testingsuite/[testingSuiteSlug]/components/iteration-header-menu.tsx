"use client";

import { useState } from "react";
import { MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { testIteration } from "@/lib/supabase/test-iterations";
import EditIterationDialog from "./edit-iteration-dialog";

// The "more" menu on the round header (TestIterationComponent). The dialog sits
// outside the menu so it stays open after the menu closes.
export default function IterationHeaderMenu({ iteration }: { iteration: testIteration }) {
	const [editOpen, setEditOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="icon" variant="outline" className="text-xs">
					<MoreVertical size={14} />
				</Button>} />
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem className="text-xs" onClick={() => setEditOpen(true)}>
						<Pencil size={14} />
						<span>Edit Iteration</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<EditIterationDialog iteration={iteration} open={editOpen} onOpenChange={setEditOpen} />
		</>
	);
}
