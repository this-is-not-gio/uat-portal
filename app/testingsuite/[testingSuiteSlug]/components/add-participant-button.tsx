"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { testIteration } from "@/lib/supabase/test-iterations";
import AddParticipantDialog from "./add-participant-dialog";

// Self-contained trigger so the (server-rendered) iteration header can offer Add Participant.
export default function AddParticipantButton({ iteration }: { iteration: testIteration }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)}>
				<Plus className="h-3.5 w-3.5" />
				<p className="text-xs">Add Participant</p>
			</Button>
			<AddParticipantDialog iteration={iteration} open={open} onOpenChange={setOpen} />
		</>
	);
}
