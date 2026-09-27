"use client";

import { Book, BookMarked, Bug, ClipboardEditIcon, FlaskConical, House, TestTubeDiagonal } from "lucide-react";
import * as React from "react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { Badge } from "./ui/badge";
import { TestingSuites } from "@/lib/supabase/Init";
import type { currentUser } from "@/lib/supabase/auth";
import { SignOutButton } from "./sign-out-button";

const data = {
	user: {
		name: "shadcn",
		email: "m@example.com",
		avatar: "/avatars/shadcn.jpg",
	},
	navMain: [
		{
			title: "Dashboard",
			url: "/dashboard",
			icon: House,
		},
		{
			title: "Master Plan",
			url: "/master-plan",
			icon: Book,
		}
	],
	// navComponents: [
	//     {
	//         title: "General",
	//         url: "#",
	//         icon: BookMarked
	//     },
	//     {
	//         title: "Company Registration",
	//         url: "/epics/company-registration",
	//         icon: BookMarked,
	//     },
	// 	{
	// 		title : "Finalizing Company Details",
	// 		url : "#",
	// 		icon : BookMarked,
	// 	},
	//     {
	//         title: "SEC Endrsement",
	//         url: "/epics/sec-endorsement",
	//         icon: BookMarked,
	//     },
	// 	{
	// 		title : "Certificate of Authority",
	// 		url : "/epics/certificate-of-authority",
	// 		icon : BookMarked,
	// 	}
	// ]
}

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



export function AppSidebar({ testingSuites, user, ...props }: React.ComponentProps<typeof Sidebar> & { testingSuites: TestingSuites; user: currentUser }) {
	const badge = BADGE_VARIANTS[user.organization?.type ?? "fallback"] ?? BADGE_VARIANTS.fallback;
	const Icon = badge.icon;
	// First + last initial ("Gio Talingdan" -> "GT"); falls back to the email when there is no name.
	const initials = (user.fullName || user.email || "?").trim().split(/\s+/).filter(Boolean)
		.map((word, i, words) => (i === 0 || i === words.length - 1 ? word[0] : "")).join("").toUpperCase();
	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<SidebarMenu className="flex flex-col gap-2">
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&_svg]:size-4"
					>
						<div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-2xl">
							<ClipboardEditIcon />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">User Acceptance Test</span>
							<Badge variant={"secondary"} className={`flex gap-1 items-center ${badge.BadgeClassName}`}>
								<Icon className="size-3" />
								<span className="font-semibold">{badge.Label}</span>
							</Badge>
						</div>
					</SidebarMenuButton>
					{/* Phase 5: org filter for Admin/Internal goes here (replaces the old mock tenant Select). */}
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavSecondary testingSuites={testingSuites} />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem className="px-2 py-1">
						<div className="flex flex-row gap-2 items-center justify-between">
							<div className="flex flex-row gap-2 items-center min-w-0">
								<div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${badge.UserClassName}`}>
									<p className="text-sm font-bold text-white">{initials}</p>
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{user.fullName || user.email}</p>
									<p className="truncate text-xs text-muted-foreground">{user.role}</p>
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
