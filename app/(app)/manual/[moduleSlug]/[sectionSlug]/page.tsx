import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { DocShell } from "@/components/manual/doc-parts"
import { ManualBlockList } from "@/components/manual/manual-blocks"
import { blockAnchors } from "@/lib/manual/slug"
import { getManualBlocks, getManualModuleBySlug } from "@/lib/supabase/manual"

export default async function ManualSectionPage({ params }: { params: Promise<{ moduleSlug: string; sectionSlug: string }> }) {
	const { moduleSlug, sectionSlug } = await params
	const manualModule = await getManualModuleBySlug(moduleSlug)
	const section = manualModule?.sections.find((s) => s.slug === sectionSlug)
	if (!manualModule || !section) notFound()

	const container = { moduleId: manualModule.id, sectionId: section.id }
	const blocks = await getManualBlocks(container)
	const anchors = blockAnchors(blocks.map((b) => b.header))

	return (
		<DocShell toc={blocks.map((b, i) => ({ id: anchors[i], label: b.header }))}>
			<section className="space-y-3">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{manualModule.title}</p>
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-semibold tracking-tight">{section.title}</h1>
					{!manualModule.isPublished && <Badge variant="outline">Draft</Badge>}
				</div>
			</section>
			<ManualBlockList container={container} blocks={blocks} anchors={anchors} />
		</DocShell>
	)
}
