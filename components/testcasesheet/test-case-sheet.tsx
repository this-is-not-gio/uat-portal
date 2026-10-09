"use client";

import { useState, useTransition } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
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
	CircleOff,
	Bug,
	Computer,
	History,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { RemarkMarkdownField } from "@/components/testcasesheet/remark-markdown-field";
import { profile, testCase, testRemark, testStepStatus } from "@/lib/supabase/test-cases";
import type { caseResultState } from "@/lib/supabase/iteration-actions";
import type { resultArchive } from "@/lib/supabase/test-iterations";
import { humanizeTimestamp } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import StepResultButton from "./step-result-buttons";
import TestCaseResult from "./test-case-result";
import { AudienceBadge } from "@/components/audience-badge";

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

type testcase_status_option = "Passed" | "Failed" | "Blocked"

const selected_test_case_status_classnames: Record<testcase_status_option, { className: string; Icon: LucideIcon }> = {
	Passed: {
		className: "border bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-400",
		Icon: CircleCheck
	},
	Failed: {
		className: " border bg-red-100/60 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 border-red-700 dark:border-red-400",
		Icon: CircleX
	},
	Blocked: {
		className: "border bg-muted text-foreground border-foreground",
		Icon: BanIcon
	},
};

const author_role_badge_classnames: Record<string, { className: string, Icon: LucideIcon }> = {
	Internal: { className: "bg-blue-100/60 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 border-blue-700 dark:border-blue-400", Icon: User },
	External: { className: "bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-40０", Icon: UserCheck },
}

// definition: the live test case (Test Cases tab), no results.
// execute:    a row of a running iteration; steps, remarks and the case result are editable.
// review:     a row of a completed iteration; results are read-only.
// canRemark:  show the remark box even in review mode (submitted org or closed round). Defaults to execute.
export type testCaseSheetMode = "definition" | "execute" | "review";

type sheetTestCase = testCase & { statusOverridden?: boolean; executor?: profile; completedAt?: string | null; archives?: resultArchive[] };

export function TestCaseSheet<T extends sheetTestCase>({ testCase, onChangeTestCase, mode = "definition", canRemark = mode === "execute", footerActions }: { testCase: T; onChangeTestCase: (updatedTestCase: T) => void; mode?: testCaseSheetMode; canRemark?: boolean; footerActions?: React.ReactNode }) {
	const showResults = mode !== "definition";
	const currentUser = useCurrentUser();
	const author = currentUser ? { id: currentUser.id, role: currentUser.role, full_name: currentUser.fullName } : undefined;
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
	const [caseState, setCaseState] = useState<caseResultState>({
		status: testCase.status,
		statusOverridden: testCase.statusOverridden ?? false,
		completedAt: testCase.completedAt ?? null,
		executor: testCase.executor,
	});
	// One transition for every result button (steps + case result): while any save runs, all of
	// them are disabled, so clicks can't race the case result the DB re-derives from the steps.
	const [isSavingResult, startSavingResult] = useTransition();
	const totalSteps = testCase.stepsToExecute?.length ?? 0;
	const testedSteps = Object.keys(stepStatuses).filter((stepId) => stepStatuses[stepId]?.status !== "Untested").length;
	const statusCounts = step_status_options.map((option) => ({
		...option,
		count: Object.values(stepStatuses).filter((step) => step.status === option.value).length,
	}));

	// Push the sheet's local state back into the table row so counts and badges follow.
	function emitChange(nextStatuses: typeof stepStatuses, nextRemarks: typeof stepRemarks, nextCaseState: caseResultState) {
		onChangeTestCase({
			...testCase,
			status: nextCaseState.status,
			statusOverridden: nextCaseState.statusOverridden,
			completedAt: nextCaseState.completedAt,
			executor: nextCaseState.executor,
			stepsToExecute: testCase.stepsToExecute?.map((step) => ({
				...step,
				status: nextStatuses[step.id]?.status ?? step.status,
				remarks: nextRemarks[step.id] ?? step.remarks,
			})),
		});
	}

	return (
		<SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[75vw] data-[side=right]:lg:w-[50vw]">
			<SheetHeader className="px-4 pt-6 md:px-8 md:pt-10">
				<SheetDescription className="text-xs text-muted-foreground">
					{testCase.code}
				</SheetDescription>
				<SheetTitle className="text-xl font-bold">
					{testCase.title}
				</SheetTitle>
				<div className="flex flex-row items-center justify-between gap-2">
					<div className="flex gap-2">
						{testCase.roleAssignee && <Badge variant="secondary">{testCase.roleAssignee}</Badge>}
						<Badge variant="secondary">{testCase.stepsToExecute?.length || 0} Steps</Badge>
						{/* {testCase.audience && <AudienceBadge audience={testCase.audience} />} */}
						<Badge variant="secondary">{testCase.audience === "both" ? "Internal & External" : testCase.audience === "internal" ? "Internal" : "External"}</Badge>
					</div>
				</div>
			</SheetHeader>
			<div className="px-4 md:px-8">
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
			<div className="flex flex-col justify-between px-4 md:px-8">
				<div className="flex flex-row items-center justify-between gap-2 pb-3 w-full">
					<div className="flex flex-row items-center gap-2 pb-3">
						<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
							<ListChecksIcon />
						</div>
						<div className="flex flex-col gap-0">
							<h3 className="text-lg font-semibold"> Steps to Execute</h3>
							<p className="text-xs text-muted-foreground">Steps to perform when running this test case.</p>
						</div>
					</div>
					{
						showResults &&
						<div className="flex flex-col items-end gap-1">
							<p className="text-xs text-muted-foreground"><span className="font-mono">{testedSteps}</span>/<span className="font-mono">{totalSteps}</span> Step Executed</p>
						</div>
					}
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
									<div key={index} className="flex flex-row gap-3 sm:gap-4 w-full group/step">
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
													{showResults && <Badge
														variant={variant}
														className={cn(
															"gap-1",
															className
														)}
													>
														<Icon className="h-4 w-4" />
														{stepStatuses[step.id]?.status || "Untested"}
													</Badge>}
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
											{showResults && <Accordion className="w-full">
												<AccordionItem className="border-none">
													<div className="flex flex-row flex-wrap items-center justify-between gap-2">
														<div className="flex items-center gap-1.5">
															{mode === "execute" ? (
																<StepResultButton
																	stepResultId={step.id}
																	caseResultId={testCase.id}
																	currentStatus={stepStatuses[step.id]?.status || "Untested"}
																	statusClassName={selected_status_classnames}
																	onStatusChange={(newStatus, nextCaseState) => {
																		const nextStatuses = { ...stepStatuses, [step.id]: { status: newStatus } };
																		setStepStatuses(nextStatuses);
																		setCaseState(nextCaseState);
																		emitChange(nextStatuses, stepRemarks, nextCaseState);
																	}}
																	options={step_status_options}
																	isPending={isSavingResult}
																	startTransition={startSavingResult}
																/>)
																: mode === "review" && stepStatuses[step.id]?.status === "Failed" ? (
																	<Button>
																		<Bug className="size-3.5" />
																		<p className="text-xs font-medium">Report Bug</p>
																	</Button>
																) : null
															}
														</div>
														<AccordionTrigger className="w-fit flex-row items-center justify-start gap-1.5 rounded-md border py-1.5 px-3 text-sm font-normal hover:no-underline hover:bg-accent">
															<MessageSquare className="h-3.5 w-3.5" />
															Remarks {
																remarks?.length > 0 ? (
																	<Badge className="w-fit">{remarks.length}</Badge>
																) : null
															}
														</AccordionTrigger>
													</div>
													<AccordionContent className="[&_p:not(:last-child)]:mb-0 ">
														<div className="flex flex-col gap-6 pt-3 sm:gap-10 sm:pt-5">
															<div className="flex flex-col gap-4">
																<div className="flex items-center gap-1">
																	<MessagesSquare size="12" />
																	<p className="text-xs font-medium">Remarks:</p>
																</div>
																<div className="group/with-remark">
																	{
																		remarks?.length > 0 ? (
																			remarks.map((remark) => {
																				const author_role_badge = remark.author?.role ? author_role_badge_classnames[remark.author.role] : undefined
																				const Icon = author_role_badge?.Icon
																				const initials = `${remark.author?.full_name?.charAt(0) || 'U'}${remark.author?.full_name?.charAt(1).toUpperCase() || 'U'}`
																				return (<div className="flex flex-row gap-2 group/remark" key={remark.id}>
																					<div className="hidden sm:flex flex-col items-center group-first/remark:pt-2">
																						<div className="w-0.5 h-2 bg-accent rounded-full self-center group-first/remark:h-0"></div>
																						<div className="size-10 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
																							<p className="text-xs font-bold">{initials}</p>
																						</div>
																						<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/remark:h-0"></div>
																					</div>
																					<div className="border w-full min-w-0 bg-accent/10 rounded-xl mb-3 sm:mb-5 group-last/remark:mb-0">
																						{/* Mobile drops the avatar column (the avatar moves in here) and the role badge. */}
																						<div className="flex flex-row items-center justify-between gap-2 border-b p-3 sm:p-4 mb-0 bg-accent/90 rounded-t-xl">
																							<div className="flex-row flex min-w-0 gap-2 items-center">
																								<div className="sm:hidden size-6 shrink-0 rounded-full flex items-center justify-center bg-primary text-white">
																									<p className="text-[10px] font-bold">{initials}</p>
																								</div>
																								<p className="text-xs sm:text-sm font-semibold truncate">{remark.author?.full_name || 'Unknown Author'}</p>
																								<Badge variant="outline" className={cn("hidden sm:inline-flex", author_role_badge?.className || "bg-muted text-foreground border-border")}>
																									{Icon && <Icon className="h-3 w-3" />}
																									{remark.author?.role || 'Unknown Role'}
																								</Badge>
																							</div>
																							<p className="text-xs text-muted-foreground shrink-0">{remark.created_at ? humanizeTimestamp(remark.created_at) : 'Unknown Time'}</p>
																						</div>
																						<div className="p-3 sm:p-4 overflow-x-auto">
																							<div className="typeset text-sm break-words">
																								<ReactMarkdown remarkPlugins={[remarkGfm]}>{remark.remark}</ReactMarkdown>
																							</div>
																						</div>
																					</div>
																				</div>
																				)
																			})

																		) : null
																	}
																	{showResults && canRemark && <div className="flex flex-row gap-2 group/remark">
																		<div className="hidden sm:flex flex-col items-center group-first/remark:pt-2">
																			<div className={`w-0.5 bg-accent rounded-full self-center ${remarks.length === 0 ? 'group-first/remark:w-0 h-7' : 'h-8'}`}></div>
																			<div className="size-10 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
																				<p className="text-xs font-bold">{author?.full_name?.charAt(0) || 'U'}{author?.full_name?.charAt(1).toUpperCase() || 'U'}</p>
																			</div>
																			<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/remark:h-0"></div>
																		</div>
																		<div className="flex flex-col gap-2 sm:gap-4 w-full min-w-0">
																			<div className="flex items-center gap-1">
																				<MessageSquareShare size="12" />
																				<p className="text-xs font-medium">Leave a Remark:</p>
																			</div>
																			<RemarkMarkdownField
																				step={step}
																				placeholder="Leave a remark for this step"
																				onSubmitted={(insertedRemark) => {
																					const nextRemarks = { ...stepRemarks, [step.id]: [...(stepRemarks[step.id] || []), insertedRemark] };
																					setStepRemarks(nextRemarks);
																					emitChange(stepStatuses, nextRemarks, caseState);
																				}}
																			/>
																		</div>
																	</div>}
																</div>
															</div>

														</div>
													</AccordionContent>
												</AccordionItem>
											</Accordion>}
										</div>
									</div>
								);
							})
						) : null
					}
				</div>
			</div>
			{/* Results the vendor archived with a force refresh, newest first. */}
			{showResults && (testCase.archives?.length ?? 0) > 0 && (
				<div className="flex flex-col px-4 md:px-8 pb-6 gap-3">
					<div className="flex flex-row items-center gap-2">
						<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
							<History />
						</div>
						<div className="flex flex-col gap-0">
							<h3 className="text-lg font-semibold">Previous results</h3>
							<p className="text-xs text-muted-foreground">Reset by the Development Team after the test case was corrected.</p>
						</div>
					</div>
					{testCase.archives!.map((archive) => (
						<div key={archive.id} className="border rounded-md">
							<div className="p-3 bg-accent/60 border-b flex flex-row items-center justify-between gap-2">
								<p className="text-sm font-semibold">Result: {archive.snapshot.status}</p>
								<p className="text-xs text-muted-foreground">
									Reset {humanizeTimestamp(archive.archivedAt)}{archive.archivedBy ? ` by ${archive.archivedBy}` : ""}
								</p>
							</div>
							<div className="p-3 flex flex-col gap-2">
								<p className="text-xs"><span className="font-medium">Reason:</span> {archive.reason}</p>
								<ol className="list-decimal list-outside pl-5 space-y-1">
									{archive.snapshot.steps.map((step, index) => (
										<li key={index} className="text-sm">
											<span>{step.step}</span>{" "}
											<Badge variant="outline" className="text-xs">{step.status}</Badge>
											{step.remarks.length > 0 && (
												<span className="text-xs text-muted-foreground"> · {step.remarks.length} remark{step.remarks.length === 1 ? "" : "s"}</span>
											)}
										</li>
									))}
								</ol>
							</div>
						</div>
					))}
				</div>
			)}
			{/* Static placeholder until bug reports are real; only meaningful next to results. */}
			{/* {showResults && <div className="flex flex-col justify-between px-8 pb-10">
				<div className="flex flex-row items-center gap-2 pb-3 ">
					<div className="flex flex-col items-center justify-center gap-0 size-12 rounded-md bg-muted p-2 text-muted-foreground">
						<Bug />
					</div>
					<div className="flex flex-col gap-0">
						<h3 className="text-lg font-semibold"> Bug Reports</h3>
						<p className="text-xs text-muted-foreground">Report the failed step and create a comprehensive diagnostic</p>
					</div>
				</div>
				<div className="flex flex-col gap-4">
					<div className="border rounded-md">
						<div className="p-4 bg-accent/90 border-b">
							<p className="font-bold">[Bug Report] Bug report content goes here.</p>
						</div>
						<div className="p-4 flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Environment</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Failed Step</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Actual Result</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
						</div>
					</div>
					<div className="border rounded-md">
						<div className="p-4 bg-accent/90 border-b">
							<p className="font-bold">[Bug Report] Bug report content goes here.</p>
						</div>
						<div className="p-4 flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Environment</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Failed Step</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Actual Result</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
						</div>
					</div>
					<div className="border rounded-md">
						<div className="p-4 bg-accent/90 border-b">
							<p className="font-bold">[Bug Report] Bug report content goes here.</p>
						</div>
						<div className="p-4 flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Environment</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Failed Step</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
							<div className="flex flex-col gap-2">
								<div className="flex flex-row items-center gap-1">
									<Computer className="size-3.5" />
									<p className="font-medium text-xs">Actual Result</p>
								</div>
								<p className="text-sm text-muted-foreground">Additional details about the bug report.</p>
							</div>
						</div>
					</div>
				</div>
			</div>} */}
			{mode === "execute" ? (
				<SheetFooter className="flex flex-row justify-between sticky bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t p-4">
					<div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
						<div className="flex flex-row items-center gap-2">
							{/* <div className="flex flex-row items-center gap-1 py-1 px-2 rounded-md text-xs font-semibold border bg-muted text-foreground border-border w-fit">
								{testedSteps} / {totalSteps} Tested Steps
								<ListChecksIcon className="h-4 w-4" />
							</div> */}
							<p className="text-xs font-medium">Test Summary:</p>
							<ResultSummaryCell statusCounts={statusCounts} />
						</div>
						<TestCaseResult
							caseResultId={testCase.id}
							current={caseState.status}
							overridden={caseState.statusOverridden}
							onChange={(nextCaseState) => {
								setCaseState(nextCaseState);
								emitChange(stepStatuses, stepRemarks, nextCaseState);
							}}
							selected_test_case_status_classnames={selected_test_case_status_classnames}
							isPending={isSavingResult}
							startTransition={startSavingResult}
						/>
					</div>
				</SheetFooter>
			) : footerActions ? (
				<SheetFooter className="flex flex-row justify-end gap-2 sticky bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t p-4">
					{footerActions}
				</SheetFooter>
			) : null}
		</SheetContent>
	)
}

// Chip colours per step status; Untested never gets a chip.
const result_summary_classnames: Record<Exclude<testStepStatus, "Untested">, { Icon: LucideIcon; className: string }> = {
	Passed: { Icon: CircleCheck, className: "bg-green-600/20 text-green-800" },
	Failed: { Icon: CircleX, className: "bg-red-600/20 text-red-800" },
	Skipped: { Icon: SkipForwardIcon, className: "bg-gray-600/20 text-gray-800" },
	Blocked: { Icon: CircleOff, className: "bg-gray-600/20 text-gray-800" },
};

// Fed from the sheet's own stepStatuses, so it updates as soon as a step is marked.
export function ResultSummaryCell({ statusCounts }: { statusCounts: { value: testStepStatus; count: number }[] }) {
	const counted = statusCounts.filter((status) => status.value !== "Untested" && status.count > 0);
	if (counted.length === 0) return <p className="text-xs text-muted-foreground">No results yet</p>;
	return (
		<Tooltip>
			<TooltipTrigger render={
				<div className="flex flex-row gap-1">
					{counted.map((status) => {
						const { Icon, className } = result_summary_classnames[status.value as Exclude<testStepStatus, "Untested">];
						return (
							<div key={status.value} className={cn("flex flex-row items-center gap-1 rounded-md py-1 px-1.5 w-fit", className)}>
								<Icon size={15} />
								<p className="font-mono text-xs">{status.count}</p>
							</div>
						);
					})}
				</div>
			}/>
			<TooltipContent>
				<p className="text-xs">
					{counted.map((status) => (
						<span key={status.value}>
							{status.value}: {status.count}
						</span>
					))}
				</p>
			</TooltipContent>
		</Tooltip>
	);
}
