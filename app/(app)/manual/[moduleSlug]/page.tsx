import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { DeleteModuleButton, HideWhenEditing, ManualContentButton, ManualDocBody, ManualPageDraftProvider, ManualStatusBanner, ManualTitleBlock, PublishModuleButton } from "@/components/manual/manual-edit"
import { DocShell } from "@/components/manual/doc-parts"
import { ManualBlockList } from "@/components/manual/manual-blocks"
import { hasBlockHeader } from "@/lib/manual/blocks"
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
		<ManualPageDraftProvider kind="module" id={manualModule.id} container={container} title={manualModule.title} description={manualModule.description} blocks={blocks}>
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
		<ManualStatusBanner isPublished={manualModule.isPublished}>
			<DeleteModuleButton moduleId={manualModule.id} moduleTitle={manualModule.title} />
			<ManualContentButton />
			<PublishModuleButton moduleId={manualModule.id} isPublished={manualModule.isPublished} />
		</ManualStatusBanner>
		<DocShell toc={blocks.flatMap((b, i) => (hasBlockHeader(b.blockType) ? [{ id: anchors[i], label: b.header }] : []))}>
			<ManualDocBody>
				<section className="space-y-3">
					<HideWhenEditing>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Testing Manual</p>
					</HideWhenEditing>
					<div className="flex items-center gap-3">
						<ManualTitleBlock kind="module" title={manualModule.title} description={manualModule.description} />
						{/* {!manualModule.isPublished && <Badge variant="outline">Draft</Badge>} */}
					</div>
				</section>
				<ManualBlockList container={container} blocks={blocks} anchors={anchors} />
			</ManualDocBody>
		</DocShell>
		</div>
		</ManualPageDraftProvider>
	)
}
