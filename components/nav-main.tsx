"use client";

import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";

export function NavMain({
    items
}: {
    items:{
        title: string;
        url: string;
        icon?: LucideIcon;
    }[]
}) {
    const pathname = usePathname();

    return (
        <SidebarGroup>
            <SidebarMenu>
                {
                    items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                tooltip={item.title}
                                isActive={item.url !== "#" && pathname.startsWith(item.url)}
                                render={<Link href={item.url} />}
                            >
                                {item.icon && <item.icon className="size-4" />}
                                <span className="ml-2">{item.title}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))
                }
            </SidebarMenu>
        </SidebarGroup>
    )
}
