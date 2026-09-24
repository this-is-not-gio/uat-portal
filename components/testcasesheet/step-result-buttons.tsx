"use client";

import { setStepResultStatus, type caseResultState } from "@/lib/supabase/iteration-actions";
import { testStepStatus } from "@/lib/supabase/test-cases";
import { useTransition } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export default function StepResultButton({
	stepResultId,
	caseResultId,
	currentStatus,
	onStatusChange,
	statusClassName,

	options
}: {
	stepResultId: string;
	caseResultId: string;
	currentStatus: testStepStatus;
	// Also hands back the case result, which the DB re-derives from its steps.
	onStatusChange: (newStatus: testStepStatus, caseState: caseResultState) => void;


	statusClassName?: {
		[key in testStepStatus]: string;
	};

	options: {
		value: testStepStatus;
		label: string;
		Icon: LucideIcon;
	}[]
}) {
	const [isPending, startTransition] = useTransition();

	const onSubmit = (newStatus: testStepStatus) => {
		startTransition(async () => {
			const result = await setStepResultStatus({ caseResultId, stepResultId, status: newStatus });
			if (result.ok) onStatusChange(newStatus, result.data);
		});
	};

	return (
		<>
			<div className="flex items-center gap-1.5">
				{
					options.map((option) => {
						const isSelected = currentStatus === option.value;
							return (
							<Tooltip key={option.value}>
								<TooltipTrigger
									render={
										<Button
											type="button"
											size="icon"
											variant="outline"
											className={cn(isSelected && statusClassName?.[option.value])}
											onClick={() => onSubmit(option.value)}
											disabled={isPending}
										>
											<option.Icon className="h-4 w-4" />
										</Button>
									}
								/>
								<TooltipContent>{option.label}</TooltipContent>
							</Tooltip>
							)
					})
				}
			</div>
		</>
	)

}
