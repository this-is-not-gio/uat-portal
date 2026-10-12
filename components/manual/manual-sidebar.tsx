"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { File, Folder, Plus } from "lucide-react"
import type { manualModule } from "@/lib/supabase/manual"
import { manualHref, manualNav } from "./manual-nav"
import { NewModuleDialog, useManualEditing } from "./manual-edit"

export function ManualSidebar({ modules }: { modules: manualModule[] }) {
	const pathname = usePathname()
	const editing = useManualEditing()

	return (
		<ScrollArea className="w-70 border-r border-border h-full min-h-0">
			<SidebarContent className="overflow-visible">
				<SidebarGroup>
					<SidebarGroupLabel>Modules</SidebarGroupLabel>
					{editing && (
						<NewModuleDialog
							trigger={
								<SidebarGroupAction title="New module">
									<Plus />
									<span className="sr-only">New module</span>
								</SidebarGroupAction>
							}
						/>
					)}
					<SidebarGroupContent>
						<SidebarMenu>
							{modules.length === 0 && (
								<p className="px-2 py-1 text-xs text-muted-foreground">No modules yet.</p>
							)}
							{modules.map((module) => (
								<SidebarMenuItem key={module.id}>
									<SidebarMenuButton
										isActive={pathname === `/manual/${module.slug}`}
										render={<Link href={`/manual/${module.slug}`} />}
									>
										<Folder />
										<span className="text-xs font-medium">{module.title}</span>
										{!module.isPublished && (
											<Badge variant="outline" className="ml-auto text-[10px]">Draft</Badge>
										)}
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
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
