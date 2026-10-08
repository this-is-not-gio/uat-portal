"use client";

import { BookMarked, ChevronRight, FolderIcon, LucideIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import SuiteDialog from "../suite-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "../ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { SidebarSuite } from "@/lib/supabase/Init";
import type { currentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { groupSuites, type badgeTone } from "./nav-suites";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { deleteSuite } from "@/lib/supabase/authoring-actions";
import ConfirmDialog from "../confirm-dialog";
import { useRef, useState } from "react";

// Badge tone -> classes. Styling is Gio's lane; these are placeholders.
const BADGE_TONE_CLASSNAMES: Record<badgeTone, string> = {
	default: "",
	active: "",
	muted: "",
	danger: "",
	success: "",
};

export function NavSecondary({ testingSuites, user }: { testingSuites: SidebarSuite[]; user: currentUser }) {
	const pathname = usePathname();
	const router = useRouter();
	const canAuthor = can(user, "author");
	const isAdmin = can(user, "admin_area");

	// The SQL function already dropped suites this role may not open; this only groups them.
	const groups = groupSuites(user.role, testingSuites);
	const emptyMessage = !user.organization && !isAdmin
		? "Your account isn't linked to an organization. Contact the admin."
		: user.role === "External" ? "No testing assigned yet" : "Nothing in testing right now";

	const renderSuite = (testingSuite: SidebarSuite) => {
		const isActive = pathname.startsWith(`/testsuite/${testingSuite.slug}`);
		//const badge = suiteBadge(user.role, testingSuite);
		const counts = testingSuite.adminCounts ?? { sections: 0, testCaseCount: 0, iterationCount: 0, resultCount: 0 };
		return (
			<SidebarMenuItem key={testingSuite.id}>
				<SidebarMenuButton
					tooltip={testingSuite.title}
					isActive={isActive}
					render={<Link href={`/testsuite/${testingSuite.slug}/overview`} />}
					className={`group/archived flex flex-row items-center gap-2 min-w-0`}
				>
					<FolderIcon />
					{/* <span className="ml-2 truncate">{testingSuite.title}</span> */}
					<TruncatedText text={testingSuite.title} side="right" />
				</SidebarMenuButton>
				{canAuthor && testingSuite.status === "draft" && (
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
										<li>{counts.sections} section{counts.sections === 1 ? "" : "s"}</li>
										<li>{counts.testCaseCount} test case{counts.testCaseCount === 1 ? "" : "s"}</li>
										<li>{counts.iterationCount} test iteration{counts.iterationCount === 1 ? "" : "s"}</li>
										<li>{counts.resultCount} recorded test result{counts.resultCount === 1 ? "" : "s"}</li>
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
		<SidebarGroup className="flex flex-col gap-1">
			{
				user.role === "Admin" && 
				<div className="flex flex-row items-center justify-between pr-2">
					<SidebarGroupLabel className="">Testing Suites</SidebarGroupLabel>
					{canAuthor && (
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
							<TooltipContent>Create New Testing Suite</TooltipContent>
						</Tooltip>
					)}
				</div>
			}
			{/* {groups.map((group, index) => group.collapsible ? (
				<Collapsible key={group.label} className="mt-2">
					<CollapsibleTrigger render={
						<SidebarGroupLabel className="group/archived cursor-pointer flex flex-row items-center gap-1 w-full">
							<ChevronRight className="size-3 transition-transform group-data-[panel-open]/archived:rotate-90" />
							{group.label} ({group.suites.length})
						</SidebarGroupLabel>
					} />
					<CollapsibleContent>
						<SidebarMenu>{group.suites.map(renderSuite)}</SidebarMenu>
					</CollapsibleContent>
				</Collapsible>
			) : (
				<div key={group.label}>
					<SidebarGroupLabel className={index > 0 ? "mt-2" : undefined}>{group.label}</SidebarGroupLabel>
					<SidebarMenu>{group.suites.map(renderSuite)}</SidebarMenu>
				</div>
			))}
			{groups.every((group) => group.suites.length === 0) && (
				<p className="px-2 py-1 text-xs text-muted-foreground">{emptyMessage}</p>
			)} */}
			{
				groups.map((group, index) => group.collapsible ? (
					<Collapsible key={group.label} className="" >
						<CollapsibleTrigger nativeButton={false} render={
							<SidebarGroupLabel className="group/archived cursor-pointer flex flex-row items-center justify-between gap-1 w-full">
								<div className="flex flex-row gap-2 items-center min-w-0">
									<div className="flex flex-row gap-1 items-center min-w-0">
										{group.icon && <group.icon className="size-3" />}
										{group.label}
									</div>
									<Badge variant="secondary" className="ml-auto shrink-0">
										{group.suites.length}
									</Badge>
								</div>
								<ChevronRight className="size-3 transition-transform group-data-[panel-open]/archived:rotate-90" />
							</SidebarGroupLabel>
						} />
						<CollapsibleContent>
							<SidebarMenu>{group.suites.map(renderSuite)}</SidebarMenu>
						</CollapsibleContent>
					</Collapsible>
				)
				: user.role === "Admin" ? (
						<SidebarGroup key={group.label} className="py-1">
							<SidebarGroupLabel className="group/archived cursor-pointer flex flex-row items-center gap-1 w-full">
								<div className="flex flex-row gap-2 items-center min-w-0">
									<div className="flex flex-row gap-1 items-center min-w-0">
										{group.icon && <group.icon className="size-3" />}
										{group.label}
									</div>
									<Badge variant="secondary" className="ml-auto shrink-0">
										{group.suites.length}
									</Badge>
								</div>
							</SidebarGroupLabel>
							<SidebarMenu>{group.suites.map(renderSuite)}</SidebarMenu>
						</SidebarGroup>
				) : (
					<div key={group.label}>
						<SidebarGroupLabel className="group/archived cursor-pointer flex flex-row items-center gap-1 w-full">
							<div className="flex flex-row gap-2 items-center min-w-0">
								<div className="flex flex-row gap-1 items-center min-w-0">
									{group.icon && <group.icon className="size-3" />}
									{group.label}
								</div>
								<Badge variant="secondary" className="ml-auto shrink-0">
									{group.suites.length}
								</Badge>
							</div>
						</SidebarGroupLabel>
						<SidebarMenu>{group.suites.map(renderSuite)}</SidebarMenu>
					</div>
				))

			}
		</SidebarGroup>
	)
}




export function TruncatedText({ text, className, side }: { text: string; className?: string; side?: "left" | "right" | "top" | "bottom" }) {
	const ref = useRef<HTMLSpanElement>(null)
	const [open, setOpen] = useState(false)

	return (
		<Tooltip
			open={open}
			onOpenChange={(next) => {
				const el = ref.current
				// Only open when the text is actually cut off
				setOpen(next && !!el && el.scrollWidth > el.clientWidth)
			}}
		>
			<TooltipTrigger render={<span ref={ref} className={cn("truncate", className)} />}>
				{text}
			</TooltipTrigger>
			<TooltipContent side={side}>{text}</TooltipContent>
		</Tooltip>
	)
}
