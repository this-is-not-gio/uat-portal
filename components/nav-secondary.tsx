"use client";

import { BookMarked, ChevronRight, LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "./ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { TestingSuites } from "@/lib/supabase/Init";
export function NavSecondary({ testingSuites }: { testingSuites: TestingSuites }) {
	const pathname = usePathname();

	return (
		testingSuites.length > 0 && (<SidebarGroup>
			<SidebarGroupLabel>Testing Suites</SidebarGroupLabel>
			<SidebarMenu>
				{
					testingSuites.map((testingSuite) => {
						return (
							<SidebarMenuItem key={testingSuite.id}>
								<SidebarMenuButton
									tooltip={testingSuite.title}
									isActive={pathname.startsWith(`/testingsuite/${testingSuite.slug}`)}
									render={<Link href={`testingsuite/${testingSuite.slug}`} />}
								>
									<span className="ml-2">{testingSuite.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>

						);
					})
				}
			</SidebarMenu>
		</SidebarGroup>)
	)
}
