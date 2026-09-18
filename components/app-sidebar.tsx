"use client";

import { Book, BookMarked, Bug, ChevronsUpDown, Cog, Gauge, House, User } from "lucide-react";
import * as React from "react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { SignOutButton } from "./sign-out-button";
import { Epics } from "@/lib/supabase/test-cases";

const data = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
    navMain: [
        {
            title: "Dashboard",
            url: "#",
            icon: House,
        },
		{
			title: "Master Plan",
			url: "#",
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

const activeTeam = {
    name: "Licensing",
    plan: "UAT",
    logo: Bug,
}

export function AppSidebar({epics, ...props }: React.ComponentProps<typeof Sidebar> & { epics: Epics[] }) {
    return(
        <Sidebar {...props} collapsible="icon">
            <SidebarHeader>
                <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <activeTeam.logo className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{activeTeam.name}</span>
                        <span className="truncate text-xs">{activeTeam.plan}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
                <NavSecondary epics={epics} />
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SignOutButton />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
