"use client";

import { BookMarked, ChevronRight, LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "./ui/sidebar";
import { Epics } from "@/lib/supabase/test-cases";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

const IconMapping: Record<string, LucideIcon> = {
	"company-registration": BookMarked,
	"finalizing-company-details": BookMarked,
	"sec-endorsement": BookMarked,
	"certificate-of-authority": BookMarked
};

export function NavSecondary({ epics }: { epics: Epics[] }) {
	const pathname = usePathname();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Components</SidebarGroupLabel>
			<SidebarMenu>
				{
					epics.map((epic) => {
						const Icon = IconMapping[epic.slug];
						return (
							<SidebarMenuItem key={epic.id}>
								<SidebarMenuButton
									tooltip={epic.title}
									isActive={epic.slug !== "#" && pathname.startsWith(epic.slug)}
									render={<Link href={epic.slug} />}
								>
									{Icon && <Icon className="size-4" />}
									<span className="ml-2">{epic.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>

							// <Collapsible
							// 	key={epic.id}
							// 	asChild
							// 	defaultOpen={epic.slug !== "#" && pathname.startsWith(epic.slug)}
							// 	className="group/collapsible">
							// 	<SidebarMenuItem>
							// 		<CollapsibleTrigger asChild>
							// 			<SidebarMenuButton>
							// 				{Icon && <Icon className="size-4" />}
							// 				<span className="ml-2">{epic.title}</span>
							// 				<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
							// 			</SidebarMenuButton>
							// 		</CollapsibleTrigger>
							// 		<CollapsibleContent>
							// 			<SidebarMenuSub>
							// 				{epic.section.map((section) => (
							// 					<SidebarMenuItem key={section.id}>
							// 						<SidebarMenuButton
							// 							tooltip={section.name}
							// 							isActive={pathname.startsWith(`/epics/${epic.slug}/${section.id}`)}
							// 							render={<Link href={`/epics/${epic.slug}/${section.id}`} />}
							// 						>
							// 							<span className="ml-2">{section.name}</span>
							// 						</SidebarMenuButton>
							// 					</SidebarMenuItem>
							// 				))}
							// 			</SidebarMenuSub>
							// 		</CollapsibleContent>
							// 	</SidebarMenuItem>
							// </Collapsible>
						);
					})
				}
			</SidebarMenu>
		</SidebarGroup>
	)
}
