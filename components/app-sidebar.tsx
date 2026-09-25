"use client";

import { Book, BookMarked, Bug, ChevronsUpDown, ClipboardEditIcon, Cog, Gauge, House, User } from "lucide-react";
import * as React from "react"
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton } from "./ui/sidebar";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { Badge } from "./ui/badge";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useState } from "react";
import { TestingSuites } from "@/lib/supabase/Init";

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

const Tenant = [
	{
		label: "IC Licensing ",
		tenantId: "tenant-01",
		tenantName: "Tenant 1",
		tenantTier: "Enterprise",
		tenantPod: "pod-1",
	},
	{
		label: "Tenant 2 · Enterprise (pod-2)",
		tenantId: "tenant-02",
		tenantName: "Tenant 2",
		tenantTier: "Enterprise",
		tenantPod: "pod-2",
	},
	{
		label: "Tenant 3 · Standard (pod-3)",
		tenantId: "tenant-03",
		tenantName: "Tenant 3",
		tenantTier: "Standard",
		tenantPod: "pod-3",
	},
	{
		label: "Tenant 4 · Standard (pod-4)",
		tenantId: "tenant-04",
		tenantName: "Tenant 4",
		tenantTier: "Standard",
		tenantPod: "pod-4",
	},
	{
		label: "Tenant 5 · Enterprise (pod-5)",
		tenantId: "tenant-05",
		tenantName: "Tenant 5",
		tenantTier: "Enterprise",
		tenantPod: "pod-5",
	},
	{
		label: "Tenant 6 · Standard (pod-6)",
		tenantId: "tenant-06",
		tenantName: "Tenant 6",
		tenantTier: "Standard",
		tenantPod: "pod-6",
	},
	{
		label: "Tenant 7 · Enterprise (pod-7)",
		tenantId: "tenant-07",
		tenantName: "Tenant 7",
		tenantTier: "Enterprise",
		tenantPod: "pod-7",
	}
]

export function AppSidebar({testingSuites, ...props }: React.ComponentProps<typeof Sidebar> & {testingSuites: TestingSuites}) {
	const [selectedTenant , setTenant] = useState(Tenant[0]);

    return(
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
							<h6 className="truncate font-semibold">User Acceptance Test</h6>
							<Badge variant="secondary" className="text-xs bg-blue-600/20">Internal Portal</Badge>
						</div>
					</SidebarMenuButton>
					<Select value={selectedTenant.tenantId} onValueChange={(value) => {
						setTenant(Tenant.find((tenant) => tenant.tenantId === value) || Tenant[0]);
					}}>
						<SelectTrigger className="bg-white border border-gray-300 rounded-md px-3 py-2 w-full data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:items-start">
							{/* <SelectValue>
								<div className="flex flex-col gap-1 w-full">
									<p className="text-sm font-semibold">{selectedTenant.label}</p>
									<p className="text-xs text-muted-foreground font-mono">{selectedTenant.tenantTier} - {selectedTenant.tenantPod}</p>
								</div>
							</SelectValue> */}
							<SelectValue>
								<p className="text-sm font-semibold">{selectedTenant.label}</p>
							</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							{Tenant.map((tenant) => (
								<SelectItem key={tenant.tenantId} value={tenant.tenantId}>
									<div className="flex flex-col gap-1 w-full">
										<p className="text-sm font-semibold">{tenant.label}</p>
										<p className="text-xs text-muted-foreground font-mono">{tenant.tenantTier} - {tenant.tenantPod}</p>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
                <NavSecondary  testingSuites={testingSuites} />
            </SidebarContent>
        </Sidebar>
    )
}
