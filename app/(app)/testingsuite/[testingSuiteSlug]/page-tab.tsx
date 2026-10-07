"use client";

import { useEffect, useState } from "react";
import {
	Activity,
	ClipboardList,
	LayoutDashboard,
	ListChecks,
	Paperclip,
	CircleIcon,
	Info,
	TestTubeDiagonal,
	Signpost,
	TriangleAlert,
	ClipboardCheck,
	Hourglass,
	RotateCwFadingClock,
	List,
	Notebook,
	Calendar,
	Users,
	IdCard,
	File,
	ChevronRight,
	Folder,
	Sheet,
	SquareKanban,
	ClipboardXIcon,
	ClipboardIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TestCase } from "@/components/types";
import { Badge } from "@/components/ui/badge";
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { DataTable } from "@/components/table/data-table";
import { TestCaseSheet } from "@/components/testcasesheet/test-case-sheet";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { clearTreeState } from "./components/tree-collapsible";
import { testCasesHref } from "@/components/testsuite-layout/test-cases/href";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";







// showTestResults is false for testers (Internal/External): their results live in the Test Cases tab.
// showSignOffTab: staff only, once the suite has a sign-off with a frozen report.
// Test Cases and Test Results have moved to their own routes under /testsuite/{slug}, so their triggers link there.
export default function PageTab({ overviewTab, signOffTab, showTestResults = true, showSignOffTab = false }: { overviewTab: React.ReactNode; signOffTab?: React.ReactNode; showTestResults?: boolean; showSignOffTab?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const tab = searchParams.get("tab") ?? "overview";
	
	const [,testSuiteSlug, sectionPath] = pathname.split("/").filter(Boolean);

	// Sidebar folders stay as the user left them while moving around Test
	// Cases; leaving the tab (by click, back button or link) resets them.
	useEffect(() => {
		if (tab !== "test-cases") clearTreeState();
	}, [tab]);

	function handleTabChange(value: string) {
		if (value === "test-cases") {
			router.push(testCasesHref(testSuiteSlug, "all"));
		} else if (value === "test-results") {
			router.push(testResultsHref(testSuiteSlug));
		} else {
			router.replace(`/testingsuite/${testSuiteSlug}?tab=${value}`);
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Tabs value={tab} onValueChange={handleTabChange} className="w-full px-4 flex flex-col border-b">
				<TabsList variant="line">
					<TabsTrigger value="overview" className="w-full">
						<LayoutDashboard data-icon="inline-start" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="test-cases" className="w-full">
						<ClipboardList data-icon="inline-start" />
						Test Cases
					</TabsTrigger>
					{showTestResults && (
						<TabsTrigger value="test-results" className="w-full">
							<ListChecks data-icon="inline-start" />
							Test Results
						</TabsTrigger>
					)}
					{showSignOffTab && (
						<TabsTrigger value="sign-off" className="w-full">
							<ClipboardCheck data-icon="inline-start" />
							Sign-off
						</TabsTrigger>
					)}
					{/* <TabsTrigger value="activity" className="w-full">
					<Activity data-icon="inline-start" />
					Activity
				</TabsTrigger>
				<TabsTrigger value="attachments" className="w-full">
					<Paperclip data-icon="inline-start" />
					Attachments
				</TabsTrigger> */}
				</TabsList>
			</Tabs>
			<Tabs value={tab} className="min-h-0 flex-1">
				<TabsContent value="overview" className="w-full h-full min-h-0">
					{overviewTab}
				</TabsContent>
				{showSignOffTab && (
					<TabsContent value="sign-off" className="w-full h-full min-h-0 flex flex-col">
						{signOffTab}
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
