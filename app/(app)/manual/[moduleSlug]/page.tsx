import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { DeleteModuleButton, EditableTitle, PublishModuleButton } from "@/components/manual/manual-edit"
import { DocShell } from "@/components/manual/doc-parts"
import { ManualBlockList } from "@/components/manual/manual-blocks"
import { blockAnchors } from "@/lib/manual/slug"
import { getManualBlocks, getManualModuleBySlug } from "@/lib/supabase/manual"

export default async function ManualModulePage({ params }: { params: Promise<{ moduleSlug: string }> }) {
	const { moduleSlug } = await params
	// RLS hides unpublished modules from non-Admins, so they come back as null here too.
	const manualModule = await getManualModuleBySlug(moduleSlug)
	if (!manualModule) notFound()

	const container = { moduleId: manualModule.id, sectionId: null }
	const blocks = await getManualBlocks(container)
	const anchors = blockAnchors(blocks.map((b) => b.header))

	return (
		<DocShell toc={blocks.map((b, i) => ({ id: anchors[i], label: b.header }))}>
			<section className="space-y-3">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Testing Manual</p>
				<div className="flex items-center gap-3">
					<EditableTitle kind="module" id={manualModule.id} title={manualModule.title} />
					{!manualModule.isPublished && <Badge variant="outline">Draft</Badge>}
					<div className="ml-auto flex items-center gap-2">
						<DeleteModuleButton moduleId={manualModule.id} moduleTitle={manualModule.title} />
						<PublishModuleButton moduleId={manualModule.id} isPublished={manualModule.isPublished} />
					</div>
				</div>
			</section>
			<ManualBlockList container={container} blocks={blocks} anchors={anchors} />
		</DocShell>
	)
}
