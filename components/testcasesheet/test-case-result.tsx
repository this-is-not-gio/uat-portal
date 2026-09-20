"use client";

import { CheckCircle2, LucideIcon, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { testCaseStatus } from "../types";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { setTestCaseResult } from "@/lib/supabase/action";




export default function TestCaseResult({
	testCaseId,
	current,
	onChange,
	selected_test_case_status_classnames
}: {
	testCaseId: string,
	current: testCaseStatus,
	onChange: (newStatus: testCaseStatus) => void,
	selected_test_case_status_classnames: 
	{
		Passed: { className: string; Icon: LucideIcon };
		Failed: { className: string; Icon: LucideIcon };
	}
}) {
	const testCaseResultOption = ["Passed", "Failed"]
	const [isPending, startTransition] = useTransition();

	const onSubmit = (newStatus: testCaseStatus) => {
		const previousStatus = current;
		startTransition(async () => {
			try {
				await setTestCaseResult({ testCaseId, status: newStatus });
				onChange(newStatus);
			} catch (error) {
				console.error("Error updating step result:", error);
				onChange(previousStatus);
			}
		});
	};

	return (
		<div className="flex flex-row items-center gap-2 justify-end w-fit">
			{
				testCaseResultOption.map((option) => (
					<Button
						key={option.at(0)}
						size="lg"
						variant="outline"
						disabled={isPending}
						className={cn(current === "Passed" && option === "Passed" ? selected_test_case_status_classnames.Passed.className : current === "Failed" && option === "Failed" ? selected_test_case_status_classnames.Failed.className : "border bg-white text-foreground border-border", "w-50")}
						onClick={() => onSubmit(option as testCaseStatus)}
					>
						{
							option === "Passed" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />
						}
						{option}
					</Button>
				))
			}
		</div>
	)
}


{/* <div className="flex flex-row items-center gap-2 justify-end w-fit">
								<SheetClose
									render={
										<Button
											size="lg"
											variant="outline"
											disabled={totalSteps > 0 && testedSteps < totalSteps}
											className={cn(
												"w-50", verdict === "Failed" ? selected_test_case_status_classnames.Failed : "border bg-muted text-foreground border-border"
											)}
											onClick={() => setVerdict("Failed")}
										>
											<XCircle className="h-4 w-4" /> Fail
										</Button>
									}
								/>
								<SheetClose
									render={
										<Button
											size="lg"
											variant="outline"
											disabled={totalSteps > 0 && testedSteps < totalSteps}
											className={cn(
												"w-50", verdict === "Passed" ? selected_test_case_status_classnames.Passed : "border bg-muted text-foreground border-border"
											)}
											onClick={() => setVerdict("Passed")}
										>
											<CheckCircle2 className="h-4 w-4" /> Pass
										</Button>
									}
								/>
							</div> */}
