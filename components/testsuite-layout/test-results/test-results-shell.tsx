"use client";

import { useEffect } from "react";
import { clearTreeState } from "@/app/(app)/testingsuite/[testingSuiteSlug]/components/tree-collapsible";

// Round folders stay as the user left them while moving around Test Results;
// leaving the tab unmounts this layout and resets them.
export default function TestResultsShell({ children }: { children: React.ReactNode }) {
	useEffect(() => clearTreeState, []);
	return <div className="flex min-h-full flex-row">{children}</div>;
}
