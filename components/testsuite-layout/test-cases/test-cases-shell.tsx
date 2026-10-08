"use client";

import { useEffect } from "react";
import type { suiteStatus } from "@/lib/supabase/Init";
import { clearTreeState } from "@/components/testsuite-layout/shared/tree-collapsible";
import { useImportStaging } from "./import-staging";
import ImportReview from "./import-review";

// existingSectionNames: the suite's current sections, so a staged import can mark new ones.
// importSuite: the suite a staged import is saved into (staff only).
export default function TestCasesShell({ existingSectionNames, importSuite, children }: { existingSectionNames: string[]; importSuite?: { id: string; status: suiteStatus }; children: React.ReactNode }) {
	const { staged } = useImportStaging();

	// Sidebar folders stay as the user left them while moving around Test Cases;
	// leaving the tab unmounts this layout and resets them.
	useEffect(() => clearTreeState, []);

	return (
		<div className="flex min-h-full flex-row">
			{/* A staged import takes over the tab until it's saved or discarded. */}
			{staged && importSuite ? <ImportReview existingSectionNames={existingSectionNames} suite={importSuite} /> : children}
		</div>
	);
}
