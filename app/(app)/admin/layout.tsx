import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";

// Everything under /admin is vendor-only. Non-admins get a 404, so the area doesn't even
// admit it exists. Layouts don't re-run on every client navigation, so this only guards
// the pages: each admin action re-checks can() itself.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
	const user = await getCurrentUser();
	if (!can(user, "admin_area")) {
		notFound();
	}

	return <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">{children}</div>;
}
