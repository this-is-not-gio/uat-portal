"use client";

import { useState } from "react";
import { ClipboardPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddSectionDialog from "./add-section-dialog";

// Beside Start on a planned round: opens the dialog to add test cases (or take them out) across
// every section.
export default function AddTestCasesButton({
	suiteId,
	iterationId,
	heldCases,
}: {
	suiteId: string;
	iterationId: string;
	heldCases: Record<string, { resultIds: string[]; included: boolean }>;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="outline" className="text-xs" onClick={() => setOpen(true)}>
				<ClipboardPlus className="size-4" />
				Add Test Cases
			</Button>
			<AddSectionDialog suiteId={suiteId} iterationId={iterationId} heldCases={heldCases} open={open} onOpenChange={setOpen} />
		</>
	);
}
