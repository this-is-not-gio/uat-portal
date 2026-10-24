"use client";

import { BanIcon, CheckCircle2, CircleCheck, CircleOff, CircleX, LucideIcon, SkipForwardIcon, TrendingUpDown, Undo2, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { testCaseStatus, testStepStatus } from "@/lib/supabase/test-cases";
import { cn } from "@/lib/utils";
import { useState, type TransitionStartFunction } from "react";
import { resetCaseResultToAuto, setAllStepResultStatus, setCaseResultStatus, type caseResultState } from "@/lib/supabase/iteration-actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

type overrideOption = "Passed" | "Failed" | "Blocked";

const OVERRIDE_OPTIONS: { value: overrideOption; Icon: LucideIcon }[] = [
	{ value: "Passed", Icon: CheckCircle2 },
	{ value: "Failed", Icon: XCircle },
	{ value: "Blocked", Icon: BanIcon },
];

const result_summary_classnames: Record<Exclude<testStepStatus, "Untested">, { Icon: LucideIcon; className: string }> = {
	Passed: { Icon: CircleCheck, className: "bg-green-600/20 text-green-800" },
	Failed: { Icon: CircleX, className: "bg-red-600/20 text-red-800" },
	Skipped: { Icon: SkipForwardIcon, className: "bg-gray-600/20 text-gray-800" },
	Blocked: { Icon: CircleOff, className: "bg-gray-600/20 text-gray-800" },
};

// Case result of a running iteration. The verdict is derived from the steps and shown as a
// status. The icon button opens the result buttons to set a different verdict by hand; in that
// mode it turns into "Return to auto verdict", which clears the override and closes them.
export default function TestCaseResult({
	caseResultId,
	current,
	overridden,
	onChange,
	onQuickResult,
	stepCount,
	selected_test_case_status_classnames,
	isPending,
	startTransition,
}: {
	caseResultId: string,
	current: testCaseStatus,
	overridden: boolean,
	onChange: (state: caseResultState) => void,
	// Quick action finished: every step now has this result.
	onQuickResult: (status: "Passed" | "Failed", state: caseResultState) => void,
	stepCount: number,
	selected_test_case_status_classnames: Record<overrideOption, { className: string; Icon: LucideIcon }>,
	// Shared by the whole sheet: any result save in flight disables every result button.
	isPending: boolean,
	startTransition: TransitionStartFunction,
}) {
	const [overrideOpen, setOverrideOpen] = useState(false);
	// Quick action waiting for the user to confirm it.
	const [pendingQuick, setPendingQuick] = useState<"Passed" | "Failed" | null>(null);
	// A case already overridden keeps its buttons visible.
	const overriding = overrideOpen || overridden;

	const onSubmit = (newStatus: overrideOption) => {
		startTransition(async () => {
			const result = await setCaseResultStatus({ caseResultId, status: newStatus });
			if (result.ok) onChange(result.data);
		});
	};

	const onReturnToAuto = () => {
		setOverrideOpen(false);
		if (!overridden) return;
		startTransition(async () => {
			const result = await resetCaseResultToAuto({ caseResultId });
			if (result.ok) onChange(result.data);
		});
	};

	const onQuickAction = (status: "Passed" | "Failed") => {
		setPendingQuick(null);
		startTransition(async () => {
			const result = await setAllStepResultStatus({ caseResultId, status });
			if (result.ok) onQuickResult(status, result.data);
		});
	};

	// In Progress / Untested have no verdict yet, so they fall back to plain muted text.
	const summary = result_summary_classnames[current as Exclude<testStepStatus, "Untested">] ?? null;

	if (current === "Untested" || current === "In Progress") return <div className="flex flex-row items-center gap-2 justify-end w-fit">
		<div className="flex flex-row items-center gap-2">
			<p className="text-xs font-medium">Quick Actions:</p>
			<Button size="lg" variant="outline" disabled={isPending} className="w-36" onClick={() => setPendingQuick("Passed")}>
				<CheckCircle2 className="h-4 w-4" />
				Passed all
			</Button>
			<Button size="lg" variant="outline" disabled={isPending} className="w-36" onClick={() => setPendingQuick("Failed")}>
				<XCircle className="h-4 w-4" />
				Failed all
			</Button>
		</div>
		<Dialog open={pendingQuick !== null} onOpenChange={(open) => { if (!open) setPendingQuick(null); }}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Mark all {stepCount} steps as {pendingQuick}?</DialogTitle>
					<DialogDescription>
						Every step of this test case will be set to {pendingQuick}, replacing any result already recorded on a step.
						{pendingQuick === "Failed" && " You will need to leave a remark with at least one evidence (a file or a link) on one of the steps before you can continue."}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>Go back</DialogClose>
					<Button onClick={() => pendingQuick && onQuickAction(pendingQuick)}>Mark all {pendingQuick}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>

	return (
		<div className="flex flex-row items-center gap-2 justify-end w-fit">
			{
				overriding ?
					<div className="flex flex-row items-center gap-2">
						<p className="text-xs font-medium">Overided Result:</p>
					</div>
					:
					<div className="flex flex-row items-center gap-2">
						<p className="text-xs font-medium">Test Result:</p>
						<Tooltip>
							<TooltipTrigger render={
								<div className={cn("flex flex-row items-center gap-1 rounded-md py-1 px-1.5 w-fit text-xs font-medium", summary?.className ?? "text-muted-foreground")}>
									{summary && <summary.Icon className="h-4 w-4" />}
									{current}
								</div>
							} />
							<TooltipContent>
								<p className="text-xs">
									{overridden ? "Set by hand instead of derived from the steps" : "Derived from the steps and updates as they change"}
								</p>
							</TooltipContent>
						</Tooltip>
					</div>
			}
			{overriding && OVERRIDE_OPTIONS.map(({ value, Icon }) => (
				<Button
					key={value}
					size="lg"
					variant="outline"
					disabled={isPending}
					className={cn(current === value ? selected_test_case_status_classnames[value].className : "border bg-white text-foreground border-border", "w-36")}
					onClick={() => onSubmit(value)}
				>
					<Icon className="h-4 w-4" />
					{value}
				</Button>
			))}
			<Tooltip>
				<TooltipTrigger render={
					<Button size="icon" variant="outline" disabled={isPending} onClick={overriding ? onReturnToAuto : () => setOverrideOpen(true)}>
						{overriding ? <Undo2 className="h-4 w-4" /> : <TrendingUpDown className="h-4 w-4" />}
					</Button>
				} />
				<TooltipContent>
					<p className="text-xs">
						{overriding ? "Return to auto verdict" : "Override result"}
					</p>
				</TooltipContent>
			</Tooltip>
		</div>
	)
}
