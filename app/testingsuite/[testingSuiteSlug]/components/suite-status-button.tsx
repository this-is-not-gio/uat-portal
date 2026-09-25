"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { setSuiteStatus } from "@/lib/supabase/iteration-actions";
import type { suiteStatus } from "@/lib/supabase/Init";

export const READINESS_ISSUES: Record<string, string> = {
	no_test_cases: "The suite has no test cases yet",
	no_steps: "Has no steps",
	step_without_expected_result: "A step has no expected result",
	no_role_assignee: "No role assignee set",
};

// "Suite is not ready: LCI-001: no_steps, (suite): no_test_cases" -> readable rows.
function parseReadinessError(message: string): { code: string; issue: string }[] | null {
	const prefix = "Suite is not ready: ";
	if (!message.startsWith(prefix)) return null;
	return message.slice(prefix.length).split(", ").map((entry) => {
		const separator = entry.lastIndexOf(": ");
		const code = entry.slice(0, separator);
		const issue = entry.slice(separator + 2);
		return { code: code === "(suite)" ? "" : code, issue: READINESS_ISSUES[issue] ?? issue };
	});
}

// Manual suite transitions (draft <-> ready, signed_off <-> archived). The DB
// validates the move; readiness failures are listed in a dialog.
export default function SuiteStatusButton({
	suiteId,
	targetStatus,
	variant = "default",
	children,
}: {
	suiteId: string;
	targetStatus: suiteStatus;
	variant?: "default" | "outline";
	children: React.ReactNode;
}) {
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const issues = error ? parseReadinessError(error) : null;

	function onClick() {
		setError(null);
		startTransition(async () => {
			const result = await setSuiteStatus({ suiteId, status: targetStatus });
			if (!result.ok) setError(result.error);
		});
	}

	return (
		<>
			<Button variant={variant} className="flex flex-row items-center gap-2" disabled={isPending} onClick={onClick}>
				{children}
			</Button>
			<Dialog open={!!error} onOpenChange={(open) => { if (!open) setError(null); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{issues ? "Not ready for testing yet" : "Couldn't change the status"}</DialogTitle>
						<DialogDescription>
							{issues ? "Every test case needs at least one step, and every step at least one expected result." : error}
						</DialogDescription>
					</DialogHeader>
					{issues && (
						<ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
							{issues.map(({ code, issue }, index) => (
								<li key={index} className="text-sm flex flex-row gap-2">
									{code && <span className="font-mono text-xs py-0.5">{code}</span>}
									<span className="text-muted-foreground">{issue}</span>
								</li>
							))}
						</ul>
					)}
					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>Close</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
