import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { DocShell } from "@/components/manual/doc-parts"
import { getManualModuleBySlug } from "@/lib/supabase/manual"

export default async function ManualModulePage({ params }: { params: Promise<{ moduleSlug: string }> }) {
	const { moduleSlug } = await params
	// RLS hides unpublished modules from non-Admins, so they come back as null here too.
	const manualModule = await getManualModuleBySlug(moduleSlug)
	if (!manualModule) notFound()

	return (
		<DocShell toc={[]}>
			<section className="space-y-3">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Testing Manual</p>
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-semibold tracking-tight">{manualModule.title}</h1>
					{!manualModule.isPublished && <Badge variant="outline">Draft</Badge>}
				</div>
			</section>
		</DocShell>
	)
}
