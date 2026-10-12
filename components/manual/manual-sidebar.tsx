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
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, File, Folder, Plus } from "lucide-react"
import type { manualModule } from "@/lib/supabase/manual"
import { manualHref, manualNav } from "./manual-nav"
import { NewModuleDialog, NewSectionDialog, useManualEditing } from "./manual-edit"

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
							{modules.map((module) => {
								const moduleActive = pathname === `/manual/${module.slug}`
								const inModule = moduleActive || pathname.startsWith(`/manual/${module.slug}/`)
								return (
									<Collapsible key={module.id} defaultOpen={inModule} render={<SidebarMenuItem />}>
										<div className="flex items-center gap-0.5">
											<CollapsibleTrigger
												className="group/trigger flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
												aria-label={`Toggle ${module.title}`}
											>
												<ChevronRight className="size-3.5 transition-transform group-data-panel-open/trigger:rotate-90" />
											</CollapsibleTrigger>
											<SidebarMenuButton
												className="flex-1"
												isActive={moduleActive}
												render={<Link href={`/manual/${module.slug}`} />}
											>
												<Folder />
												<span className="text-xs font-medium">{module.title}</span>
												{!module.isPublished && (
													<Badge variant="outline" className="ml-auto text-[10px]">Draft</Badge>
												)}
											</SidebarMenuButton>
											{editing && (
												<NewSectionDialog
													moduleId={module.id}
													moduleTitle={module.title}
													trigger={
														<button
															type="button"
															title="New section"
															className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
														>
															<Plus className="size-3.5" />
															<span className="sr-only">New section in {module.title}</span>
														</button>
													}
												/>
											)}
										</div>
										<CollapsibleContent>
											<SidebarMenuSub>
												{module.sections.length === 0 && (
													<p className="px-2 py-1 text-xs text-muted-foreground">No sections.</p>
												)}
												{module.sections.map((section) => (
													<SidebarMenuSubItem key={section.id}>
														<SidebarMenuSubButton
															size="sm"
															isActive={pathname === `/manual/${module.slug}/${section.slug}`}
															render={<Link href={`/manual/${module.slug}/${section.slug}`} />}
														>
															<File />
															<span>{section.title}</span>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</Collapsible>
								)
							})}
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
