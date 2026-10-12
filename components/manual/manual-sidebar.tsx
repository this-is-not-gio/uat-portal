"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { File } from "lucide-react"
import { manualHref, manualNav } from "./manual-nav"

export function ManualSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname()

	return (
		<ScrollArea className="w-70 border-r border-border h-full min-h-0">
			<SidebarContent className="overflow-visible">
				{manualNav.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.slug}>
										<SidebarMenuButton
											isActive={pathname === manualHref(item.slug)}
											render={<Link href={manualHref(item.slug)} />}
										>
											<File />
											<span className="text-xs font-medium">{item.title}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
		</ScrollArea>
	)
}
