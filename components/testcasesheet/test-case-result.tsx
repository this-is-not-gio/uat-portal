"use client";

import { BanIcon, CheckCircle2, LucideIcon, RotateCcw, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { testCaseStatus } from "@/lib/supabase/test-cases";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { resetCaseResultToAuto, setCaseResultStatus, type caseResultState } from "@/lib/supabase/iteration-actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type overrideOption = "Passed" | "Failed" | "Blocked";

const OVERRIDE_OPTIONS: { value: overrideOption; Icon: LucideIcon }[] = [
	{ value: "Passed", Icon: CheckCircle2 },
	{ value: "Failed", Icon: XCircle },
	{ value: "Blocked", Icon: BanIcon },
];

// Case result of a running iteration. The status is normally derived from the
// steps; clicking a button overrides it by hand, "Reset to auto" goes back.
export default function TestCaseResult({
	caseResultId,
	current,
	overridden,
	onChange,
	selected_test_case_status_classnames
}: {
	caseResultId: string,
	current: testCaseStatus,
	overridden: boolean,
	onChange: (state: caseResultState) => void,
	selected_test_case_status_classnames: Record<overrideOption, { className: string; Icon: LucideIcon }>
}) {
	const [isPending, startTransition] = useTransition();

	const onSubmit = (newStatus: overrideOption) => {
		startTransition(async () => {
			const result = await setCaseResultStatus({ caseResultId, status: newStatus });
			if (result.ok) onChange(result.data);
		});
	};

	const onReset = () => {
		startTransition(async () => {
			const result = await resetCaseResultToAuto({ caseResultId });
			if (result.ok) onChange(result.data);
		});
	};

	return (
		<div className="flex flex-row items-center gap-2 justify-end w-fit">
			{overridden && (
				<>
					<Tooltip>
						<TooltipTrigger render={<Badge variant="outline" className="text-xs">Overridden</Badge>} />
						<TooltipContent>Set by hand instead of derived from the steps</TooltipContent>
					</Tooltip>
					<Button size="lg" variant="ghost" disabled={isPending} onClick={onReset}>
						<RotateCcw className="h-4 w-4" />
						Reset to auto
					</Button>
				</>
			)}
			{
				OVERRIDE_OPTIONS.map(({ value, Icon }) => (
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
				))
			}
		</div>
	)
}
