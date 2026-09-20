"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import type { Priority, TestCase } from "@/components/types";
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
import { TestCaseSheet } from "../testcasesheet/test-case-sheet";
import { Badge } from "../ui/badge";

const priorityStyles: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/20 text-primary-foreground",
  high: "bg-destructive/15 text-destructive",
};

const laneBadgeStyles: Record<TestCase["status"], string> = {
  Untested: "",
  "In Progress": "border-amber-600/30 bg-amber-100/60 text-amber-700 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-400",
  Passed: "border-green-600/30 bg-green-100/60 text-green-700 dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-400",
  Failed: "border-red-600/30 bg-red-100/60 text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-400",
};

const laneBadgeLabels: Record<TestCase["status"], string> = {
  Untested: "Not Tested",
  "In Progress": "In Progress",
  Passed: "Passed",
  Failed: "Failed",
};

export function TestCaseCard({ testCase }: { testCase: TestCase }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: testCase.id });

  return (
	<Sheet>
		<SheetTrigger nativeButton={false} render= {
			<Card
				ref={setNodeRef}
				style={{ transform: CSS.Transform.toString(transform), transition }}
				{...attributes}
				{...listeners}
				className={cn(
					"cursor-grab touch-none select-none active:cursor-grabbing",
					isDragging && "opacity-50"
				)}
				>
				<CardContent className="flex flex-col gap-2">
					<div className="">
						<p className="text-xs text-muted-foreground">{testCase.id} - {testCase.section}</p>
						<p className="text-sm font-medium leading-snug">{testCase.title}</p>
					</div>
					{testCase.description && (
					<p className="text-xs text-muted-foreground">{testCase.description}</p>
					)}
					<div className="flex items-center justify-between pt-1">
						<div className="flex items-center gap-2">
							{/* {testCase.priority && (
								<span
									className={cn(
									"rounded-full px-2 py-0.5 text-xs font-medium capitalize",
									priorityStyles[testCase.priority]
									)}
								>
									{testCase.priority}
								</span>
							)} */}
							{
								testCase.stepsToExecute ? (
									<Badge variant="secondary">{testCase.stepsToExecute.length} Steps</Badge>
								) : null
							}
							{testCase.roleAssignee && (
								<Badge variant="secondary">{testCase.roleAssignee}</Badge>
							)}
						</div>
						<Badge variant="outline" className={laneBadgeStyles[testCase.status]}>
							{laneBadgeLabels[testCase.status]}
						</Badge>
					</div>
				</CardContent>
			</Card>
		}>
			
		</SheetTrigger>
		<TestCaseSheet testCase={testCase} />
	</Sheet>
    
  );
}
