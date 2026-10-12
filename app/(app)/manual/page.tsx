import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NewModuleDialog } from "@/components/manual/manual-edit"
import { getCurrentUser } from "@/lib/supabase/auth"
import { getManualTree } from "@/lib/supabase/manual"
import { can } from "@/lib/auth/permissions"

export default async function ManualPage() {
	const [modules, user] = await Promise.all([getManualTree(), getCurrentUser()])
	if (modules.length > 0) redirect(`/manual/${modules[0].slug}`)

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
			<p className="text-sm font-medium">No manual content yet</p>
			{can(user, "admin_area") && (
				<NewModuleDialog
					trigger={
						<Button size="sm">
							<Plus className="size-4" />
							New module
						</Button>
					}
				/>
			)}
		</div>
	)
}
