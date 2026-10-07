import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/ui/empty-state";

// Vendor-only, like /admin: non-admins get a 404. Placeholder until exports are designed.
export default async function ExportsPage() {
	const user = await getCurrentUser();
	if (!can(user, "admin_area")) {
		notFound();
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
			<h1 className="text-xl font-semibold">Exports</h1>
			<EmptyState
				icon={Download}
				title="Exports are coming soon"
				description="Download suite results and sign-off reports from here."
			/>
		</div>
	);
}
