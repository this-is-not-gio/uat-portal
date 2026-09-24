"use client";

import { BookMarked, ChevronRight, FolderIcon, LucideIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import SuiteDialog from "./suite-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "./ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { TestingSuites } from "@/lib/supabase/Init";
import { deleteSuite } from "@/lib/supabase/authoring-actions";
import ConfirmDialog from "@/app/testingsuite/[testingSuiteSlug]/components/confirm-dialog";

export function NavSecondary({ testingSuites }: { testingSuites: TestingSuites }) {
	const pathname = usePathname();
	const router = useRouter();

	// Drafts get their own group (hidden from testers once roles exist); archived
	// suites are tucked into a collapsed group.
	const activeSuites = testingSuites.filter((suite) => suite.status !== "draft" && suite.status !== "archived");
	const draftSuites = testingSuites.filter((suite) => suite.status === "draft");
	const archivedSuites = testingSuites.filter((suite) => suite.status === "archived");

	const renderSuite = (testingSuite: TestingSuites[number]) => {
						const isActive = pathname.startsWith(`/testingsuite/${testingSuite.slug}`);
						return (
							<SidebarMenuItem key={testingSuite.id}>
								<SidebarMenuButton
									tooltip={testingSuite.title}
									isActive={isActive}
									render={<Link href={`/testingsuite/${testingSuite.slug}`} />}
								>
									<FolderIcon/>
									<span className="ml-2">{testingSuite.title}</span>
								</SidebarMenuButton>
								{testingSuite.status === "draft" && (
									<Tooltip>
										<ConfirmDialog
											title="Delete testing suite"
											description="This will permanently delete the testing suite and all its associated data."
											body={
												<div className="flex flex-col gap-2">
													<p className="text-sm text-muted-foreground">
														Are you sure you want to delete the testing suite <strong>{testingSuite.title}</strong>? This action cannot be undone.
													</p>
													<p className="text-sm text-muted-foreground">This will also permanently delete:</p>
													<ul className="text-sm text-muted-foreground list-disc list-inside">
														<li>{testingSuite.section.length} section{testingSuite.section.length === 1 ? "" : "s"}</li>
														<li>{testingSuite.testCaseCount} test case{testingSuite.testCaseCount === 1 ? "" : "s"}</li>
														<li>{testingSuite.iterationCount} test iteration{testingSuite.iterationCount === 1 ? "" : "s"}</li>
														<li>{testingSuite.resultCount} recorded test result{testingSuite.resultCount === 1 ? "" : "s"}</li>
													</ul>
												</div>
											}
											confirmLabel="Delete suite"
											onConfirm={() => deleteSuite({ suiteId: testingSuite.id })}
											onDone={() => { if (isActive) router.push("/dashboard"); }}
											trigger={
												<TooltipTrigger render={
													<SidebarMenuAction showOnHover aria-label={`Delete ${testingSuite.title}`}>
														<Trash2 />
													</SidebarMenuAction>
												} />
											}
										/>
										<TooltipContent>Delete suite</TooltipContent>
									</Tooltip>
								)}
							</SidebarMenuItem>

						);
	};

	return (
		<SidebarGroup>
			<div className="flex flex-row items-center justify-between pr-2">
				<SidebarGroupLabel>Testing Suites</SidebarGroupLabel>
				<Tooltip>
					<SuiteDialog
						trigger={
							<TooltipTrigger render={
								<Button variant="ghost" size="icon" className="size-6" aria-label="New testing suite">
									<Plus className="h-3.5 w-3.5" />
								</Button>
							} />
						}
					/>
					<TooltipContent>New testing suite</TooltipContent>
				</Tooltip>
			</div>
			<SidebarMenu>
				{activeSuites.map(renderSuite)}
			</SidebarMenu>
			{draftSuites.length > 0 && (
				<>
					<SidebarGroupLabel className="mt-2">Drafts</SidebarGroupLabel>
					<SidebarMenu>{draftSuites.map(renderSuite)}</SidebarMenu>
				</>
			)}
			{archivedSuites.length > 0 && (
				<Collapsible className="mt-2">
					<CollapsibleTrigger render={
						<SidebarGroupLabel className="group/archived cursor-pointer flex flex-row items-center gap-1 w-full">
							<ChevronRight className="size-3 transition-transform group-data-[panel-open]/archived:rotate-90" />
							Archived ({archivedSuites.length})
						</SidebarGroupLabel>
					} />
					<CollapsibleContent>
						<SidebarMenu>{archivedSuites.map(renderSuite)}</SidebarMenu>
					</CollapsibleContent>
				</Collapsible>
			)}
		</SidebarGroup>
	)
}
