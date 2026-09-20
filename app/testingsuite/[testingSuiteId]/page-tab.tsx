"use client";

import { useState } from "react";
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
import { EpicWorkspace } from "@/components/epic-workspace";
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
import { columns } from "@/components/table/columns";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Board } from "@/components/board/board";
import OverviewTab from "./overview-tab";
import { usePathname, useSearchParams, useRouter } from "next/navigation";







export default function PageTab({ testCasesTab }: { testCasesTab: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const tab = searchParams.get("tab") ?? "overview";

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Tabs value={tab} onValueChange={(value) => router.replace(`${pathname}?tab=${value}`)} className="w-full px-4 flex flex-col border-b">
				<TabsList variant="line">
					<TabsTrigger value="overview" className="w-full">
						<LayoutDashboard data-icon="inline-start" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="test-cases" className="w-full">
						<ClipboardList data-icon="inline-start" />
						Test Cases
					</TabsTrigger>
					<TabsTrigger value="test-results" className="w-full">
						<ListChecks data-icon="inline-start" />
						Test Results
					</TabsTrigger>
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
					<OverviewTab />
				</TabsContent>
				<TabsContent value="test-cases" className="w-full h-full min-h-0 flex flex-row">
					{testCasesTab}
				</TabsContent>
			</Tabs>
		</div>
	);
}

