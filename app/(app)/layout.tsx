import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSidebarSuites } from "@/lib/supabase/Init";
import { getCurrentUser } from "@/lib/supabase/auth";
import { CurrentUserProvider } from "@/components/current-user-provider";

// The logged-in app shell. proxy.ts already redirects logged-out requests; this is the
// backstop, and it narrows `user` to non-null for everything below.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const user = await getCurrentUser();
	if (!user) redirect("/login");

	const testSuites = await getSidebarSuites(user);
	return (
		<CurrentUserProvider user={user}>
			<TooltipProvider>
				<SidebarProvider
					style={
						{
							"--sidebar-width": "calc(var(--spacing) * 72)",
							"--header-height": "calc(var(--spacing) * 12)",
						} as React.CSSProperties
					}>
					<AppSidebar testingSuites={testSuites} user={user} />
					{/* min-w-0: a flex item defaults to its content's width, so wide content (e.g. the zoomed
					    sign-off sheets) would widen the whole app instead of scrolling inside its own area. */}
					<SidebarInset className="min-w-0">
						<div className="flex min-h-0 flex-1 flex-col overflow-y-hidden">
							<SiteHeader testingSuites={testSuites} />
							{children}
						</div>
					</SidebarInset>
				</SidebarProvider>
			</TooltipProvider>
		</CurrentUserProvider>
	);
}
