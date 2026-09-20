"use client";

import { setStepResult } from "@/lib/supabase/action";
import { testStepStatus } from "@/lib/supabase/test-cases";
import { useRef, useState, useTransition } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export default function StepResultButton({
	stepId,
	testCaseId,
	currentStatus,
	onStatusChange,
	statusClassName,

	options
}: {
	stepId: string;
	testCaseId: string;
	currentStatus: testStepStatus;
	onStatusChange: (newStatus: testStepStatus) => void;


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
		const previousStatus = currentStatus;
		startTransition(async () => {
			try {
				await setStepResult({ testCaseId, stepId, status: newStatus });
				onStatusChange(newStatus);
			} catch (error) {
				console.error("Error updating step result:", error);
				onStatusChange(previousStatus); // Revert to previous status on error
			}
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

