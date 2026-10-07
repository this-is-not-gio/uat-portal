"use client";

import { Book, BookMarked, Bug, ChevronRight, Clipboard, ClipboardEditIcon, Download, FlaskConical, House, Pencil, TestTubeDiagonal, UserGroup, Users } from "lucide-react";
import * as React from "react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { Badge } from "../ui/badge";
import type { SidebarSuite } from "@/lib/supabase/Init";
import type { currentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { SignOutButton } from "../sign-out-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import NavTestCase from "./nav-testcase";


const BADGE_VARIANTS = {
	external: {
		Label: "Regulated Entity",
		BadgeClassName: "bg-blue-600/20 text-blue-800",
		UserClassName: "bg-blue-800",
		icon: TestTubeDiagonal
	},
	client: {
		Label: "IC Staffs",
		BadgeClassName: "bg-green-600/20 text-green-800",
		UserClassName: "bg-green-800",
		icon: FlaskConical
	},
	vendor: {
		Label: "Development Team",
		BadgeClassName: "bg-yellow-600/20 text-yellow-800",
		UserClassName: "bg-yellow-600",
		icon: BookMarked
	},
	fallback: {
		Label: "Unknown",
		BadgeClassName: "bg-gray-600/20 text-gray-800",
		UserClassName: "bg-gray-800",
		icon: Bug
	}
}

const data = {
	navMain: [
		{ title: "Master Plan", url: "/masterPlan", icon: BookMarked },
		{ title: "Users", url: "/admin/users", icon: Users },
	],
	// navTester: [
	// 	{ title: "Dashboard", url: "/dashboard", icon: House },
	// 	{ title: "Test Suites", url: "/testingsuite", icon: Book },
	// ]
}	



export function AppSidebar({ testingSuites, user, ...props }: React.ComponentProps<typeof Sidebar> & { testingSuites: SidebarSuite[]; user: currentUser }) {
	const isAdmin = can(user, "admin_area");
	const badge = BADGE_VARIANTS[user.organization?.type ?? "fallback"] ?? BADGE_VARIANTS.fallback;
	const Icon = badge.icon;
	// First + last initial ("Gio Talingdan" -> "GT"); falls back to the email when there is no name.
	const initials = (user.fullName || user.email || "?").trim().split(/\s+/).filter(Boolean)
		.map((word, i, words) => (i === 0 || i === words.length - 1 ? word[0] : "")).join("").toUpperCase();
	return (
		<Sidebar {...props} className="">
			<SidebarHeader className="flex flex-col gap-2 px-2 pt-4">
				<SidebarMenu className="flex flex-col gap-2">
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&_svg]:size-4"
					>
						<div className="flex aspect-square items-center size-10 justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-2xl">
							<Clipboard className="size-5!" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">User Acceptance Test</span>
							<span className="truncate text-xs text-muted-foreground"> {badge.Label}</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent className="px-1 py-0">
				<NavTestCase testingSuites={testingSuites} user={user} />
				<NavMain items={isAdmin ? data.navMain : []} />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem className="px-1 pb-4">
						<div className="flex flex-row gap-2 items-center justify-between">
							<div className="flex flex-row gap-2 items-center min-w-0">
								<div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${badge.UserClassName}`}>
									<p className="text-sm font-bold text-white">{initials}</p>
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{user.fullName || user.email}</p>
									<p className="truncate text-xs text-muted-foreground">{isAdmin ? user.role : user.organization?.name ?? user.role}</p>
								</div>
							</div>
							<SignOutButton />
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	)
}
