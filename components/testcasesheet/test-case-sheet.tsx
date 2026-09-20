"use client";

import { useState } from "react";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button";
import {
	BanIcon,
	CheckCircle2,
	ClipboardCheckIcon,
	ListChecksIcon,
	SkipForwardIcon,
	XCircle,
	MessageSquare,
	type LucideIcon,
	ListCheck,
	BadgeCheckIcon,
	MessagesSquare,
	MessageSquareShare,
	Info,
	TestTube2,
	UserCheck,
	User,
	CircleCheck,
	CircleX,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { RemarkMarkdownField } from "@/components/testcasesheet/remark-markdown-field";
import { testCase, testCaseStatus, testRemark, testStepStatus } from "@/lib/supabase/test-cases";
import { setStepResult } from "@/lib/supabase/action";
import { humanizeTimestamp } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StepResultButton from "./step-result-buttons";
import TestCaseResult from "./test-case-result";

const step_status_options: {
	value: testStepStatus;
	label: string;
	Icon: LucideIcon;
}[] = [
		{ value: "Passed", label: "Passed", Icon: CheckCircle2 },
		{ value: "Failed", label: "Failed", Icon: XCircle },
		{ value: "Skipped", label: "Skipped", Icon: SkipForwardIcon },
		{ value: "Blocked", label: "Blocked", Icon: BanIcon },
	];

const step_status_badge: Record<testStepStatus, { variant: "secondary" | "default" | "destructive" | "outline"; icon: LucideIcon; className?: string }> = {
	Untested: {
		variant: "outline",
		icon: TestTube2,
	},
	Passed: {
		variant: "default",
		icon: CheckCircle2,
		className: "bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400",
	},
	Failed: {
		variant: "destructive",
		icon: XCircle,
	},
	Skipped: {
		variant: "secondary",
		icon: SkipForwardIcon,
	},
	Blocked: {
		variant: "secondary",
		icon: BanIcon,
	},
}

const selected_status_classnames: Record<testStepStatus, string> = {
	Untested: "",
	Passed: "border bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-400",
	Failed: " border bg-red-100/60 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 border-red-700 dark:border-red-400",
	Skipped: "border bg-muted text-foreground border-border",
	Blocked: "border bg-muted text-foreground border-border",
};

const status_count_classnames: Record<testStepStatus, string> = {
	Untested: "border bg-muted text-foreground border-border",
	Passed: "border bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-400",
	Failed: "border bg-red-100/60 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 border-red-700 dark:border-red-400",
	Skipped: "border bg-muted text-foreground border-border",
	Blocked: "border bg-muted text-foreground border-border",
};

type testcase_status_option = "Passed" | "Failed"

const selected_test_case_status_classnames: Record<testcase_status_option, { className: string; Icon: LucideIcon }> = {
	Passed: {
		className: "border bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-400",
		Icon: CircleCheck
	},
	Failed: {
		className: " border bg-red-100/60 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 border-red-700 dark:border-red-400",
		Icon: CircleX
	},
};

const author_role_badge_classnames: Record<string, { className: string, Icon: LucideIcon }> = {
	Internal: { className: "bg-blue-100/60 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 border-blue-700 dark:border-blue-400", Icon: User },
	External: { className: "bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-40０", Icon: UserCheck },
}

const sample_author = {
	id: "sample-author-1",
	role: "Internal",
	full_name: "Gio Talindan"
}

export function TestCaseSheet({ testCase, onChangeTestCase }: { testCase: testCase; onChangeTestCase: (updatedTestCase: testCase) => void }) {
	//console.log("Rendering TestCaseSheet with testCase:", testCase); // Log the testCase prop to see what is passed
	const PLACEHOLDER_PIC_ID = "efac1d13-b5e3-464a-a4e3-1c4702fc96ed"
	const [stepStatuses, setStepStatuses] = useState<Record<string, { status: testStepStatus }>>(
		() => {
			return testCase.stepsToExecute?.reduce((acc, step) => ({ ...acc, [step.id]: { status: step.status ?? "Untested" } }), {}) || {};
		}
	);
	const [stepRemarks, setStepRemarks] = useState<Record<string, testRemark[]>>(
		() => {
			return testCase.stepsToExecute?.reduce((acc, step) => ({ ...acc, [step.id]: step.remarks || [] }), {}) || {};
		}
	);
	console.log("Initial stepRemarks state:", stepRemarks); // Log the initial state of stepRemarks
	const [testCaseStatus, setTestCaseStatus] = useState<testCaseStatus>(testCase.status);
	const totalSteps = testCase.stepsToExecute?.length ?? 0;
	const testedSteps = Object.keys(stepStatuses).filter((stepId) => stepStatuses[stepId]?.status !== "Untested").length;
	const statusCounts = step_status_options.map((option) => ({
		...option,
		count: Object.values(stepStatuses).filter((step) => step.status === option.value).length,
	}));
	
	return (
		<SheetContent className="overflow-y-auto data-[side=right]:w-[50vw] data-[side=right]:sm:max-w-[50vw]">
			<SheetHeader className="px-8 pt-10">
				<SheetDescription className="text-xs text-muted-foreground">
					{testCase.code}
				</SheetDescription>
				<SheetTitle className="text-xl font-bold">
					{testCase.title}
				</SheetTitle>
				<div className="flex gap-2">
					<Badge variant="secondary">{testCase.roleAssignee}</Badge>
					<Badge variant="secondary">{testCase.stepsToExecute?.length || 0} Steps</Badge>
				</div>
			</SheetHeader>
			<div className="px-8">
				<div className="flex flex-row items-center gap-2 pb-3 ">
					<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
						<ClipboardCheckIcon />
					</div>
					<div className="flex flex-col gap-0">
						<h3 className="text-lg font-semibold m"> Preconditions</h3>
						<p className="text-xs text-muted-foreground">Things need to consider before executing the test case.</p>
					</div>
				</div>
				{
					testCase.preconditions && testCase.preconditions.length > 0 ?
						<ul className="list-disc list-outside py-2 pl-8 pr-4 space-y-1">
							{
								testCase.preconditions.map((precondition, index) => (
									<li key={index} className="py-1">
										{precondition.condition}
									</li>
								))
							}
						</ul> :
						<EmptyState
							icon={Info}
							title="No preconditions required"
							description="This test case can be executed directly."
						/>
				}
			</div>
			<div className="flex flex-col justify-between px-8">
				<div className="flex flex-row items-center gap-2 pb-3 ">
					<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
						<ListChecksIcon />
					</div>
					<div className="flex flex-col gap-0">
						<h3 className="text-lg font-semibold"> Steps to Execute</h3>
						<p className="text-xs text-muted-foreground">Steps to perform when running this test case.</p>
					</div>
				</div>
				<div className="flex flex-col p-4">
					{
						testCase.stepsToExecute && testCase.stepsToExecute.length > 0 ? (
							testCase.stepsToExecute.map((step, index) => {
								const remarks = stepRemarks[step.id]
								const status = step_status_badge[stepStatuses[step.id]?.status as keyof typeof step_status_badge] ?? step_status_badge.Untested;
								const Icon = status.icon as LucideIcon
								const variant = status.variant as "secondary" | "default" | "destructive" | "outline";
								const className = status.className || "";


								return (
									<div key={index} className="flex flex-row gap-4 w-full group/step">
										<div className="w-fit flex flex-col ">
											<div key={index} className="size-4 rounded-full border p-4 flex flex-col items-center justify-center gap-2 bg-accent text-accent-foreground">
												<p className="text-xs font-bold">{index + 1}</p>
											</div>
											<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/step:h-0"></div>
										</div>
										<div className="flex flex-col justify-between gap-5 w-full mb-5 pb-5 border-b group-last/step:border-b-0 group-last:mb-0 group-last:pb-0">
											<div className="flex flex-col gap-2">
												<div className="flex flex-row justify-between items-center gap-2">
													<p className="font-semibold text-lg">{step.step}</p>
													<Badge
														variant={variant}
														className={cn(
															"gap-1",
															className
														)}
													>
														<Icon className="h-4 w-4" />
														{stepStatuses[step.id]?.status || "Untested"}
													</Badge>
												</div>
												<div className="flex flex-col gap-2">
													<div className="flex items-center gap-1">
														<BadgeCheckIcon size="12" />
														<p className="text-xs font-medium">Expected Result:</p>
													</div>
													<ol className="list-disc list-outside pl-5 space-y-1">
														{
															step.expectedResults && step.expectedResults.length > 0 ? (
																step.expectedResults.map((expectedResult) => (
																	<li key={expectedResult.id} className="text-sm text-muted-foreground py-1">
																		{expectedResult.result}
																	</li>
																))
															) : (
																<li className="text-sm text-muted-foreground list-none">No expected results.</li>
															)
														}
													</ol>
												</div>
											</div>
											<Accordion className="w-full">
												<AccordionItem className="border-none">
													<div className="flex flex-row items-center justify-between gap-2">
														<div className="flex items-center gap-1.5">
															<StepResultButton 
																stepId={step.id}
																testCaseId={testCase.id}
																currentStatus={stepStatuses[step.id]?.status || null}
																statusClassName={selected_status_classnames}
																onStatusChange={(newStatus) => {
																	setStepStatuses((current) => ({
																		...current,
																		[step.id]: { status: newStatus },
																	}));
																}}
																options={step_status_options}
															/>
														</div>
														<AccordionTrigger className="w-fit flex-row items-center justify-start gap-1.5 rounded-md border py-1.5 px-3 text-sm font-normal hover:no-underline hover:bg-accent">
															<MessageSquare className="h-3.5 w-3.5" />
															Remarks {
																remarks.length > 0 ? (
																	<Badge className="w-fit">{remarks.length}</Badge>
																) : null
															}
														</AccordionTrigger>
													</div>
													<AccordionContent className="[&_p:not(:last-child)]:mb-0 ">
														<div className="flex flex-col gap-10 pt-5">
															<div className="flex flex-col gap-4">
																<div className="flex items-center gap-1">
																	<MessagesSquare size="12" />
																	<p className="text-xs font-medium">Remarks:</p>
																</div>
																<div className="group/with-remark">
																	{
																		remarks.length > 0 ? (
																			remarks.map((remark) => {
																				const author_role_badge = remark.author?.role ? author_role_badge_classnames[remark.author.role] : undefined
																				const Icon = author_role_badge?.Icon as LucideIcon
																				return (<div className="flex flex-row gap-2 group/remark" key={remark.id}>
																					<div className="flex flex-col items-center group-first/remark:pt-2">
																						<div className="w-0.5 h-2 bg-accent rounded-full self-center group-first/remark:h-0"></div>
																						<div className="size-10 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
																							<p className="text-xs font-bold">{remark.author?.full_name?.charAt(0) || 'U'}{remark.author?.full_name?.charAt(1).toUpperCase() || 'U'}</p>
																						</div>
																						<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/remark:h-0"></div>
																					</div>
																					<div className="border w-full bg-accent/10 rounded-xl mb-5 group-last/remark:mb-0">
																						<div className="flex flex-row items-center justify-between gap-2 border-b p-4 mb-0 bg-accent/90 rounded-t-xl">
																							<div className="flex-row flex gap-2 items-center">
																								<p className="text-sm font-semibold">{remark.author?.full_name || 'Unknown Author'}</p>
																								<Badge variant="outline" className={author_role_badge?.className || "bg-muted text-foreground border-border"}>
																									<Icon className="h-3 w-3" />
																									{remark.author?.role || 'Unknown Role'}
																								</Badge>
																							</div>
																							<p className="text-xs text-muted-foreground">{remark.created_at ? humanizeTimestamp(remark.created_at) : 'Unknown Time'}</p>
																						</div>
																						<div className="p-4">
																							<div className="typeset text-sm">
																								<ReactMarkdown remarkPlugins={[remarkGfm]}>{remark.remark}</ReactMarkdown>
																							</div>
																						</div>
																					</div>
																				</div>
																				)
																			})

																		) : null
																	}
																	<div className="flex flex-row gap-2 group/remark">
																		<div className="flex flex-col items-center group-first/remark:pt-2">
																			<div className={`w-0.5 bg-accent rounded-full self-center ${remarks.length === 0 ? 'group-first/remark:w-0 h-7' : 'h-8'}`}></div>
																			<div className="size-10 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
																				<p className="text-xs font-bold">{sample_author?.full_name?.charAt(0) || 'U'}{sample_author?.full_name?.charAt(1).toUpperCase() || 'U'}</p>
																			</div>
																			<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/remark:h-0"></div>
																		</div>
																		<div className="flex flex-col gap-4 w-full">
																			<div className="flex items-center gap-1">
																				<MessageSquareShare size="12" />
																				<p className="text-xs font-medium">Leave a Remark:</p>
																			</div>
																			<RemarkMarkdownField
																				PIC={PLACEHOLDER_PIC_ID} // Replace with actual user ID
																				step={step}
																				placeholder="Leave a remark for this step"
																				onSubmitted = {async (insertedRemark) => {
																					setStepRemarks((current) => ({
																						...current,
																						[step.id]: [...(current[step.id] || []), insertedRemark],
																					}));
																				}}
																			/>
																		</div>
																	</div>
																</div>
															</div>

														</div>
													</AccordionContent>
												</AccordionItem>
											</Accordion>
										</div>
									</div>
								);
							})
						) : null
					}
				</div>
			</div>
			<SheetFooter className="flex flex-row justify-between sticky bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t p-4">
				<div className="flex flex-row items-center gap-2 justify-between w-full">
					<div className="flex flex-row items-center gap-2 justify-start w-fit">
						{statusCounts
							.filter((status) => status.count > 0)
							.map((status) => (
								<div className={cn(
									"flex flex-row items-center gap-1 py-1 px-2 rounded-md text-xs font-semibold",
									status_count_classnames[status.value]
								)} key={status.value}>
									{status.count} {status.label}
									<status.Icon className="h-3 w-3" />
								</div>
							))}
					</div>
					{
						testedSteps === totalSteps ? (
							// <div className="flex flex-row items-center gap-2 justify-end w-fit">
							// 	<SheetClose
							// 		render={
							// 			<Button
							// 				size="lg"
							// 				variant="outline"
							// 				disabled={totalSteps > 0 && testedSteps < totalSteps}
							// 				className={cn(
							// 					"w-50", verdict === "Failed" ? selected_test_case_status_classnames.Failed : "border bg-muted text-foreground border-border"
							// 				)}
							// 				onClick={() => setVerdict("Failed")}
							// 			>
							// 				<XCircle className="h-4 w-4" /> Fail
							// 			</Button>
							// 		}
							// 	/>
							// 	<SheetClose
							// 		render={
							// 			<Button
							// 				size="lg"
							// 				variant="outline"
							// 				disabled={totalSteps > 0 && testedSteps < totalSteps}
							// 				className={cn(
							// 					"w-50", verdict === "Passed" ? selected_test_case_status_classnames.Passed : "border bg-muted text-foreground border-border"
							// 				)}
							// 				onClick={() => setVerdict("Passed")}
							// 			>
							// 				<CheckCircle2 className="h-4 w-4" /> Pass
							// 			</Button>
							// 		}
							// 	/>
							// </div>
							<TestCaseResult
								testCaseId={testCase.id}
								current={testCaseStatus}
								onChange={(newStatus) => {
									setTestCaseStatus(newStatus);
									onChangeTestCase({ ...testCase, status: newStatus });
								}}
								selected_test_case_status_classnames={selected_test_case_status_classnames}
							/>
						) : (
							<div className="flex flex-row items-center gap-1 py-1 px-2 rounded-md text-xs font-semibold border bg-muted text-foreground border-border w-fit">
								{testedSteps} / {totalSteps} Tested Steps
								<ListChecksIcon className="h-4 w-4" />
							</div>

						)
					}
				</div>




			</SheetFooter>
		</SheetContent>
	)
}
