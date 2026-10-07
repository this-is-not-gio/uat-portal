"use client";

import { useEffect, useState } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Check, ChevronDown, ClipboardCheck, ClipboardList, LayoutDashboard, ListChecks } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type SuiteTabsProps = {
	suiteSlug: string;
	showTestResults: boolean;
	showSignOff: boolean;
};

// Narrow screens collapse tabs into a "More" menu: Sign-off below lg, Test Results too below md.
export default function SuiteTabs({ suiteSlug, showTestResults, showSignOff }: SuiteTabsProps) {
	// Each tab is a route under the suite, so the URL (not state) decides which one is active.
	const router = useRouter();
	const value = useSelectedLayoutSegment() ?? "overview";
	const goTo = (tab: string) =>
		router.push(`/testsuite/${suiteSlug}/${tab === "test-cases" ? "test-cases/all" : tab}`);
	const [menuOpen, setMenuOpen] = useState(false);

	// Close the menu when the width crosses md/lg, so it doesn't float under a hidden trigger.
	useEffect(() => {
		const queries = ["(min-width: 768px)", "(min-width: 1024px)"].map((q) => window.matchMedia(q));
		const close = () => setMenuOpen(false);
		queries.forEach((mq) => mq.addEventListener("change", close));
		return () => queries.forEach((mq) => mq.removeEventListener("change", close));
	}, []);

	// The menu only appears at widths where at least one tab is collapsed into it.
	const moreVisibility = showSignOff ? "lg:hidden" : showTestResults ? "md:hidden" : "hidden";

	return (
		<Tabs value={value} onValueChange={(tab) => goTo(String(tab))} className="w-full px-4 flex flex-col border-b">
			<TabsList variant="line" className="md:w-fit w-full">
				<TabsTrigger value="overview" className="w-fit">
					<LayoutDashboard data-icon="inline-start" />
					Overview
				</TabsTrigger>
				<TabsTrigger value="test-cases" className="w-fit">
					<ClipboardList data-icon="inline-start" />
					Test Cases
				</TabsTrigger>
				{showTestResults && (
					<TabsTrigger value="test-results" className="w-full hidden md:inline-flex">
						<ListChecks data-icon="inline-start" />
						Test Results
					</TabsTrigger>
				)}
				{showSignOff && (
					<TabsTrigger value="sign-off" className="w-full hidden lg:inline-flex">
						<ClipboardCheck data-icon="inline-start" />
						Sign-off
					</TabsTrigger>
				)}
				{(showTestResults || showSignOff) && (
					<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
						<DropdownMenuTrigger className={`${moreVisibility} inline-flex shrink-0 items-center gap-1 px-2 text-sm font-medium text-foreground/60 hover:text-foreground`}>
							More
							<ChevronDown className="size-4" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-auto min-w-40">
							{showTestResults && (
								<DropdownMenuItem className="md:hidden" onClick={() => goTo("test-results")}>
									<ListChecks />
									Test Results
									{value === "test-results" && <Check className="ml-auto" />}
								</DropdownMenuItem>
							)}
							{showSignOff && (
								<DropdownMenuItem className="lg:hidden" onClick={() => goTo("sign-off")}>
									<ClipboardCheck />
									Sign-off
									{value === "sign-off" && <Check className="ml-auto" />}
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</TabsList>
		</Tabs>
	);
}
