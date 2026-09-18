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
} from "lucide-react";
import type { TestCase, TestRemark, TestStatus } from "@/components/types";
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

const STATUS_OPTIONS: {
	value: TestStatus;
	label: string;
	Icon: LucideIcon;
}[] = [
		{ value: "pass", label: "Passed", Icon: CheckCircle2 },
		{ value: "fail", label: "Failed", Icon: XCircle },
		{ value: "skipped", label: "Skipped", Icon: SkipForwardIcon },
		{ value: "blocked", label: "Blocked", Icon: BanIcon },
	];

const STATUS_BADGE_CLASSNAMES: Record<TestStatus, string> = {
	pass: "border-green-600/30 bg-green-100/60 text-green-700 dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-400 w-40",
	fail: "border-red-600/30 bg-red-100/60 text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-400 w-40",
	skipped: "border-border bg-muted text-muted-foreground",
	blocked: "border-border bg-muted text-muted-foreground",
};

const STATUS_ICON_CLASSNAMES: Record<TestStatus, string> = {
	pass: "bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400",
	fail: "bg-red-100/60 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400",
	skipped: "bg-muted text-foreground",
	blocked: "bg-muted text-foreground",
};

type DisplayRemark = TestRemark & { author?: string; timestamp?: string };

// Sample remarks for design purposes; shown when a step has no remarks yet from Supabase.
const SAMPLE_REMARKS: DisplayRemark[] = [
	{
		id: "sample-remark-1",
		remark: "Confirmation modal flashes briefly before the redirect completes on Safari.",
		author: "Maria Santos (Client)",
		timestamp: "2 days ago",
	},
	{
		id: "sample-remark-2",
		remark: "Re-tested after the latest deploy, no longer reproducible.",
		author: "QA - Rogelio",
		timestamp: "1 day ago",
	},
];

export function TestCaseSheet({ testCase }: { testCase: TestCase }) {
	const [stepStatuses, setStepStatuses] = useState<Record<string, TestStatus>>({});
	const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});
	const [localRemarks, setLocalRemarks] = useState<Record<string, DisplayRemark[]>>({});
	const [verdict, setVerdict] = useState<TestStatus | null>(null);
	const totalSteps = testCase.stepsToExecute?.length ?? 0;
	const testedSteps = Object.keys(stepStatuses).length;
	const statusCounts = STATUS_OPTIONS.map((option) => ({
		...option,
		count: Object.values(stepStatuses).filter((value) => value === option.value).length,
	}));
	return (
		<SheetContent className="overflow-y-auto data-[side=right]:w-[50vw] data-[side=right]:sm:max-w-[50vw]">
			<SheetHeader className="px-8 pt-10">
				<SheetDescription className="text-xs text-muted-foreground">
					{testCase.id} - {testCase.section}
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
								const remarks: DisplayRemark[] = [
									...(step.remarks && step.remarks.length > 0 ? step.remarks : SAMPLE_REMARKS),
									...(localRemarks[step.id] ?? []),
								];
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
													{/* <Badge
														variant="outline"
														className={cn("w-fit", stepStatuses[step.id] ? STATUS_BADGE_CLASSNAMES[stepStatuses[step.id]] : "border-border bg-muted text-muted-foreground")}
													>
														{stepStatuses[step.id] ? stepStatuses[step.id].toUpperCase() : "NOT TESTED"}
													</Badge> */}
													<Badge
														variant="outline">
														NOT TESTED
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
															{STATUS_OPTIONS.map((option) => {
																const isSelected = stepStatuses[step.id] === option.value;
																return (
																	<Tooltip key={option.value}>
																		<TooltipTrigger
																			render={
																				<Button
																					type="button"
																					size="icon"
																					variant="outline"
																					className={cn(isSelected && STATUS_ICON_CLASSNAMES[option.value])}
																					onClick={() =>
																						setStepStatuses((current) => ({
																							...current,
																							[step.id]: option.value,
																						}))
																					}
																				>
																					<option.Icon className="h-4 w-4" />
																				</Button>
																			}
																		/>
																		<TooltipContent>{option.label}</TooltipContent>
																	</Tooltip>
																);
															})}
														</div>
														<AccordionTrigger className="w-fit flex-row items-center justify-start gap-1.5 rounded-md border py-1.5 px-3 text-sm font-normal hover:no-underline hover:bg-accent">
															<MessageSquare className="h-3.5 w-3.5" />
															Remarks <Badge className="w-fit">{remarks.length}</Badge>
														</AccordionTrigger>
													</div>
													<AccordionContent className="[&_p:not(:last-child)]:mb-0 ">
														<div className="flex flex-col gap-10 pt-5">
															<div className="flex flex-col gap-4">
																<div className="flex items-center gap-1">
																	<MessagesSquare size="12" />
																	<p className="text-xs font-medium">Remarks:</p>
																</div>
																<div className="">
																	{
																		remarks.length > 0 ? (
																			remarks.map((remark) => (
																				<div className="flex flex-row gap-2 group/remark" key={remark.id}>
																					<div className="flex flex-col items-center group-first/remark:pt-2">
																						<div className="w-0.5 h-2 bg-accent rounded-full self-center group-first/remark:h-0"></div>
																						<div className="size-10 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-accent-foreground">
																							<p className="text-xs font-bold">{remark.author?.charAt(0) || 'U'}{remark.author?.charAt(1).toUpperCase() || 'U'}</p>
																						</div>
																						<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/remark:h-0"></div>
																					</div>
																					<div className="border w-full bg-accent/10 rounded-xl mb-5 group-last/remark:mb-0">
																						<div className="flex flex-row items-center justify-between gap-2 border-b p-4 mb-0">
																							<p className="text-sm">{remark.author || 'Unknown Author'}</p>
																							<p className="text-xs text-muted-foreground">{remark.timestamp || 'Unknown Time'}</p>
																						</div>
																						<div className="p-4">
																							<p className="text-sm ">{remark.remark}</p>
																						</div>
																					</div>
																				</div>
																			))
																		) : null
																	}
																</div>
															</div>
															<div className="flex flex-col gap-4">
																<div className="flex items-center gap-1">
																	<MessageSquareShare size="12" />
																	<p className="text-xs font-medium">Leave a Remark:</p>
																</div>
																<RemarkMarkdownField
																	value={remarkDrafts[step.id] ?? ""}
																	onChange={(text) =>
																		setRemarkDrafts((current) => ({ ...current, [step.id]: text }))
																	}
																	onCancel={() =>
																		setRemarkDrafts((current) => ({ ...current, [step.id]: "" }))
																	}
																	onSubmit={() => {
																		const text = remarkDrafts[step.id]?.trim();
																		if (!text) return;
																		setLocalRemarks((current) => ({
																			...current,
																			[step.id]: [
																				...(current[step.id] ?? []),
																				{ id: `local-${Date.now()}`, remark: text, author: "You", timestamp: "Just now" },
																			],
																		}));
																		setRemarkDrafts((current) => ({ ...current, [step.id]: "" }));
																	}}
																/>
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
								<Badge
									key={status.value}
									variant="outline"
									className={cn("gap-1", STATUS_BADGE_CLASSNAMES[status.value])}
								>
									{status.count} {status.label}
									<status.Icon className="h-4 w-4" />
								</Badge>
							))}
					</div>
					<Badge variant="outline" className="gap-1">
						{testedSteps} / {totalSteps} Tested Steps
						<ListChecksIcon className="h-4 w-4" />
					</Badge>
				</div>
				<div className="flex flex-row items-center gap-2 justify-end w-fit">
					<SheetClose
						render={
							<Button
								size="lg"
								variant="outline"
								disabled={totalSteps > 0 && testedSteps < totalSteps}
								className={STATUS_BADGE_CLASSNAMES.pass}
								onClick={() => setVerdict("pass")}
							>
								<CheckCircle2 className="h-4 w-4" /> Pass
							</Button>
						}
					/>
					<SheetClose
						render={
							<Button
								size="lg"
								variant="outline"
								disabled={totalSteps > 0 && testedSteps < totalSteps}
								className={STATUS_BADGE_CLASSNAMES.fail}
								onClick={() => setVerdict("fail")}
							>
								<XCircle className="h-4 w-4" /> Fail
							</Button>
						}
					/>
					{/* <Button variant="outline" className="w-32" onClick={() => setStepStatuses({})}>Reset</Button>
					<SheetClose
						render={
							<Button className="w-32" disabled={totalSteps > 0 && testedSteps < totalSteps}>
								Close
							</Button>
						}
					/> */}
				</div>
			</SheetFooter>
		</SheetContent>
	)
}
