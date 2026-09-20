"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestCaseCard } from "./test-case-card";
import { LANES, type testCaseStatus, type TestCase } from "@/components/types";
import { CheckCircle2, ClipboardIcon, ClipboardList, HourglassIcon, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";

const LANE_STYLES: Record<
	testCaseStatus,
	{
		card: string;
		badge: string;
		iconBg: string;
		icon: string;
		EmptyIcon: typeof CheckCircle2;
		emptyTitle: string;
		emptyDescription: string;
	}
> = {
	Untested: {
		card: "bg-muted/40",
		badge: "",
		iconBg: "bg-muted/90",
		icon: "text-muted-foreground",
		EmptyIcon: ClipboardList,
		emptyTitle: "Backlog is Empty",
		emptyDescription: "New test cases will show up here.",
	},
	"In Progress": {
		card: "bg-amber-100/20 dark:bg-amber-950/20",
		badge: "border-amber-600/30 bg-amber-100/60 text-amber-700 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-400",
		iconBg: "bg-amber-100/70 dark:bg-amber-950/40",
		icon: "text-amber-600 dark:text-amber-400",
		EmptyIcon: HourglassIcon,
		emptyTitle: "No Tests In Progress",
		emptyDescription: "Test cases currently being worked on will show up here.",
	},
	Passed: {
		card: "bg-green-100/20 dark:bg-green-950/20",
		badge: "border-green-600/30 bg-green-100/60 text-green-700 dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-400",
		iconBg: "bg-green-100/70 dark:bg-green-950/40",
		icon: "text-green-600 dark:text-green-400",
		EmptyIcon: CheckCircle2,
		emptyTitle: "No Passed Tests Yet",
		emptyDescription: "Test cases marked as passed will show up here.",
	},
	Failed: {
		card: "bg-red-100/20 dark:bg-red-950/20",
		badge: "border-red-600/30 bg-red-100/60 text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-400",
		iconBg: "bg-red-100/70 dark:bg-red-950/40",
		icon: "text-red-600 dark:text-red-400",
		EmptyIcon: XCircle,
		emptyTitle: "No Failed Tests",
		emptyDescription: "Test cases marked as failed will show up here.",
	},
};

export function Swimlane({
	id,
	title,
	testCases,
}: {
	id: testCaseStatus;
	title: string;
	testCases: TestCase[];
}) {
	const { setNodeRef } = useDroppable({ id });
	const { Icon } = LANES.find((lane) => lane.id === id) || { Icon: ClipboardIcon };
	const swimlaneIconSize = "h-4 w-4";
	const styles = LANE_STYLES[id];

	return (
		<Card className={`flex h-full flex-1 shrink-0 flex-col gap-0 pb-0 ${styles.card}`}>
			<CardHeader className="flex-row items-center justify-between border-b pb-3">
				<CardTitle className="flex flex-row items-center gap-2">
					<Icon className={`${swimlaneIconSize} ${styles.icon}`}/>
					<span className="mr-2 text-sm font-medium flex flex-row items-center gap-2">
						{title}
						<Badge variant="outline" className={styles.badge}>{testCases.length}</Badge>
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent
				ref={setNodeRef}
				className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-0"
			>
				{
					testCases.length === 0 ? <>
					<div className="flex flex-col flex-1 items-center justify-center gap-4">
						<div className={`flex flex-col items-center justify-center gap-2 size-20 rounded-2xl ${styles.iconBg}`}>
							<styles.EmptyIcon size={40} className={styles.icon}/>
						</div>
						<div className="flex flex-col items-center justify-center gap-1">
							<p className="text-xl font-bold text-muted-foreground">{styles.emptyTitle}</p>
							<p className="text-muted-foreground">{styles.emptyDescription}</p>
						</div>
					</div>
					</> :
					<ScrollArea className="h-full w-full px-2">
						<div className="flex flex-col gap-2 p-2">
							<SortableContext
							id={id}
							items={testCases.map((testCase) => testCase.id)}
							strategy={verticalListSortingStrategy}
							>
								{testCases.map((testCase) => (
									<TestCaseCard key={testCase.id} testCase={testCase} />
								))}
							</SortableContext>
						</div>
					</ScrollArea>
				}
			</CardContent>
		</Card>
	);
}
