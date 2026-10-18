"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, File, Folder, FolderOpenIcon, Pencil, Plus } from "lucide-react"
import type { manualModule } from "@/lib/supabase/manual"
import { ManualEditToggle, NewModuleDialog, NewSectionDialog, useManualEditing } from "./manual-edit"
import { ManualSortableList, ManualSortableRow } from "./manual-sortable"
import { reorderManualModules, reorderManualSections } from "@/lib/supabase/manual-reorder-actions"

export function ManualSidebar({ modules, baseHref, readOnly = false }: { modules: manualModule[]; baseHref: string; readOnly?: boolean }) {
	const pathname = usePathname()
	// Read-only hides the edit toggle, create dialogs and drag handles, whatever the edit context says.
	const editing = useManualEditing() && !readOnly
	// Modules follow the current route until the user toggles one by hand.
	const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})

	return (
		<div className="w-100 border-r border-border h-full min-h-0 relative">
			{modules.length > 0 ? (
				// pb-24 keeps the last rows clear of the absolutely-positioned edit toggle
				<ScrollArea className="h-full min-h-0">
					<SidebarContent className="overflow-visible pb-24">
						<SidebarGroup>
							<SidebarGroupLabel>Testing Manuals</SidebarGroupLabel>
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
									<ManualSortableList items={modules} onReorder={(ids) => reorderManualModules({ moduleIds: ids })}>
										{(orderedModules) => orderedModules.map((module) => {
											const moduleActive = pathname === `${baseHref}/${module.slug}`
											const inModule = moduleActive || pathname.startsWith(`${baseHref}/${module.slug}/`)
											return (
												<ManualSortableRow key={module.id} id={module.id} editing={editing}>
													{({ setNodeRef, style, handle }) => (
														<Collapsible open={openOverrides[module.id] ?? inModule} onOpenChange={(open) => setOpenOverrides((prev) => ({ ...prev, [module.id]: open }))} render={<SidebarMenuItem ref={setNodeRef} style={style} />}>
															<div className="flex items-center gap-0.5">
																{handle}
																<CollapsibleTrigger
																	className="group/trigger flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
																	aria-label={`Toggle ${module.title}`}
																>
																	<ChevronRight className="size-3.5 transition-transform group-data-panel-open/trigger:rotate-90" />
																</CollapsibleTrigger>
																<SidebarMenuButton
																	className="flex-1"
																	isActive={moduleActive}
																	render={<Link href={`${baseHref}/${module.slug}`} />}
																>
																	<Folder />
																	<span className="text-xs font-medium">{module.title}</span>
																	{!module.isPublished && (
																		<Badge variant="outline" className="ml-auto text-xs gap-2">
																			<Pencil className="size-1" />
																			Draft
																		</Badge>
																	)}
																</SidebarMenuButton>
																{editing && (
																	<NewSectionDialog
																		moduleId={module.id}
																		moduleTitle={module.title}
																		tooltip={`New section in "${module.title}"`}
																		trigger={
																			<Button size="icon" variant="ghost" className="size-6 shrink-0">
																				<Plus className="size-3.5" />
																				<span className="sr-only">New section in {module.title}</span>
																			</Button>
																		}
																	/>
																)}
															</div>
															<CollapsibleContent>
																<SidebarMenuSub>
																	{module.sections.length === 0 && (
																		<p className="px-2 py-1 text-xs text-muted-foreground">No sections.</p>
																	)}
																	<ManualSortableList items={module.sections} onReorder={(ids) => reorderManualSections({ moduleId: module.id, sectionIds: ids })}>
																		{(orderedSections) => orderedSections.map((section) => (
																			<ManualSortableRow key={section.id} id={section.id} editing={editing}>
																				{({ setNodeRef: setSectionRef, style: sectionStyle, handle: sectionHandle }) => (
																					<SidebarMenuSubItem ref={setSectionRef} style={sectionStyle} className="flex items-center gap-0.5">
																						{sectionHandle}
																						<SidebarMenuSubButton
																							size="sm"
																							isActive={pathname === `${baseHref}/${module.slug}/${section.slug}`}
																							render={<Link href={`${baseHref}/${module.slug}/${section.slug}`} />}
																						>
																							<File />
																							<span>{section.title}</span>
																						</SidebarMenuSubButton>
																					</SidebarMenuSubItem>
																				)}
																			</ManualSortableRow>
																		))}
																	</ManualSortableList>
																</SidebarMenuSub>
															</CollapsibleContent>
														</Collapsible>
													)}
												</ManualSortableRow>
											)
										})}
									</ManualSortableList>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</ScrollArea>
			) : (
				<div className="h-full min-h-0 flex flex-col items-center justify-center gap-4">
					<div className="bg-gray-400/10 rounded-md p-4">
						<FolderOpenIcon className="mx-auto size-12 text-muted-foreground" />
					</div>
					<div className="flex flex-col items-center text-center">
						<p className="font-heading font-semibold">No Testing Manual</p>
						<p className="text-xs text-muted-foreground">Create a new manual to get started.</p>
					</div>
					{editing && (
						<NewModuleDialog
							trigger={
								<Button size="sm" className="text-xs">
									<Plus className="size-4" />
									Create Manual Module	
								</Button>
							}
						/>
					)}
				</div>
			)}
			{!readOnly && <ManualEditToggle />}
		</div>
	)
}
