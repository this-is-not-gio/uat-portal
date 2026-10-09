import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { Users } from "lucide-react";
import UserTabShell from "@/components/user/user-tab-shell";

// Everything under /admin is vendor-only. Non-admins get a 404, so the area doesn't even
// admit it exists. Layouts don't re-run on every client navigation, so this only guards
// the pages: each admin action re-checks can() itself.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
	const user = await getCurrentUser();
	if (!can(user, "admin_area")) {
		notFound();
	}

	// return <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">{children}</div>
	return <div className="flex min-h-0 flex-1 flex-col gap-2">
		<div className="flex flex-row gap-4 px-8 pt-8 pb-4">
			<div className="p-3 bg-accent rounded-lg w-fit border border-accent-foreground">
				<Users />
			</div>
			<div className="">
				<p className="text-lg font-semibold">Participants Management</p>
				<p className="text-xs text-muted-foreground">This is where you can manage participants. Invite new users or edit existing ones.</p>
			</div>
		</div>
		<UserTabShell/>
		<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">{children}</div>
	</div>
}

