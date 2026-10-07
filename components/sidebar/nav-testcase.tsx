import { currentUser } from "@/lib/supabase/auth";
import { SidebarSuite } from "@/lib/supabase/Init";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Clipboard, FolderIcon, FolderOpen, Home, House, Plus, PlusCircle, Sidebar, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { can } from "@/lib/auth/permissions";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { groupSuites } from "./nav-suites";
import { deleteSuite } from "@/lib/supabase/authoring-actions";
import ConfirmDialog from "../confirm-dialog";
import SuiteDialog from "../suite-dialog";
import { Badge } from "../ui/badge";


export default function NavTestCase({ testingSuites, user }: { testingSuites: SidebarSuite[]; user: currentUser }) {
	const pathname = usePathname();
	const router = useRouter();
	const canAuthor = can(user, "author");
	const isAdmin = can(user, "admin_area");

	const [createOpen, setCreateOpen] = useState(false);

	const groups = groupSuites(user.role, testingSuites);

	const renderSuite = (testingSuite: SidebarSuite) => {
		const isActive = pathname.startsWith(`/testingsuite/${testingSuite.slug}`);
		const counts = testingSuite.adminCounts ?? { sections: 0, testCaseCount: 0, iterationCount: 0, resultCount: 0 };
		return (
			<SidebarMenuItem key={testingSuite.id}>
				<SidebarMenuButton
					tooltip={testingSuite.title}
					isActive={isActive}
					render={<Link href={`/testingsuite/${testingSuite.slug}`} />}
					className={`group/archived flex flex-row items-center gap-2 min-w-0`}
				>
					<FolderOpen />
					{/* <span className="ml-2 truncate">{testingSuite.title}</span> */}
					<TruncatedText text={testingSuite.title} side="right" className="text-xs" />
				</SidebarMenuButton>
				{canAuthor && testingSuite.status === "draft" && (
					<Tooltip>
						<ConfirmDialog
							title="Delete testing suite"
							description="This will permanently delete the testing suite and all its associated data."
							body={
								<div className="flex flex-col gap-2">
									<p className="text-sm text-muted-foreground">
										Are you sure you want to delete the testing suite <strong>{testingSuite.title}</strong>? This action cannot be undone.
									</p>
									<p className="text-sm text-muted-foreground">This will also permanently delete:</p>
									<ul className="text-sm text-muted-foreground list-disc list-inside">
										<li>{counts.sections} section{counts.sections === 1 ? "" : "s"}</li>
										<li>{counts.testCaseCount} test case{counts.testCaseCount === 1 ? "" : "s"}</li>
										<li>{counts.iterationCount} test iteration{counts.iterationCount === 1 ? "" : "s"}</li>
										<li>{counts.resultCount} recorded test result{counts.resultCount === 1 ? "" : "s"}</li>
									</ul>
								</div>
							}
							confirmLabel="Delete suite"
							onConfirm={() => deleteSuite({ suiteId: testingSuite.id })}
							onDone={() => { if (isActive) router.push("/dashboard"); }}
							trigger={
								<TooltipTrigger render={
									<SidebarMenuAction showOnHover aria-label={`Delete ${testingSuite.title}`}>
										<Trash2 />
									</SidebarMenuAction>
								} />
							}
						/>
						<TooltipContent>Delete suite</TooltipContent>
					</Tooltip>
				)}
			</SidebarMenuItem>
		)
	}


	return (
		<>
			<SidebarGroup>
				<SidebarGroupContent className="flex flex-col ">
					<SidebarMenu className="flex flex-col gap-0.5">
						{
							user.role === "Admin" && canAuthor ?
								<SidebarMenuItem className="flex items-center gap-2">
									<SidebarMenuButton tooltip="Create Test Suite" isActive={false}
										onClick={() => setCreateOpen(true)}
										className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
									>
										<PlusCircle />
										<span className="text-xs">Create Test Suite</span>
									</SidebarMenuButton>
									<SuiteDialog open={createOpen} onOpenChange={setCreateOpen} />
									<Tooltip>
										<TooltipContent side="right" className="bg-gray-800 text-gray-100">
											<p>Dashboard</p>
										</TooltipContent>
										<TooltipTrigger render={<Button
											size="icon"
											className="size-8 group-data-[collapsible=icon]:opacity-0"
											variant={pathname.startsWith("/dashboard") ? "secondary" : "outline"}
											nativeButton={false}
											render={<Link href="/dashboard" />}
										>
											<House className="size-4" />
											<span className="sr-only">Dashboard</span>
										</Button>} />
									</Tooltip>
								</SidebarMenuItem>
								:
								<SidebarMenuItem className="flex items-center gap-2">
									<SidebarMenuButton tooltip="Dashboard" isActive={pathname.startsWith("/dashboard")} render={<Link href="/dashboard" />}>
										<Clipboard className="size-4" />
										<span className="text-xs">My Testing</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
						}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
			{
				groups.map((group, index) => (
					<SidebarGroup className="flex flex-col gap-1 py-0" key={group.label}>
						<SidebarGroupLabel className="text-xs font-semibold text-muted-foreground" key={group.label}>
							{group.label}
						</SidebarGroupLabel>
						{group.suites.map(renderSuite)}
					</SidebarGroup>
				))

			}
		</>
	)
}


export function TruncatedText({ text, className, side }: { text: string; className?: string; side?: "left" | "right" | "top" | "bottom" }) {
	const ref = useRef<HTMLSpanElement>(null)
	const [open, setOpen] = useState(false)

	return (
		<Tooltip
			open={open}
			onOpenChange={(next) => {
				const el = ref.current
				// Only open when the text is actually cut off
				setOpen(next && !!el && el.scrollWidth > el.clientWidth)
			}}
		>
			<TooltipTrigger render={<span ref={ref} className={cn("truncate", className)} />}>
				{text}
			</TooltipTrigger>
			<TooltipContent side={side}>{text}</TooltipContent>
		</Tooltip>
	)
}
