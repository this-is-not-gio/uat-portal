import { notFound } from "next/navigation"
import { DeleteSectionButton, HideWhenEditing, ManualContentButton, ManualDocBody, ManualPageDraftProvider, ManualStatusBanner, ManualTitleBlock } from "@/components/manual/manual-edit"
import { DocShell } from "@/components/manual/doc-parts"
import { ManualBlockList } from "@/components/manual/manual-blocks"
import { hasBlockHeader } from "@/lib/manual/blocks"
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
		<ManualPageDraftProvider kind="section" id={section.id} container={container} title={section.title} description={section.description} blocks={blocks}>
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
		<ManualStatusBanner kind="section" isPublished={manualModule.isPublished}>
			<DeleteSectionButton sectionId={section.id} sectionTitle={section.title} />
			<ManualContentButton />
		</ManualStatusBanner>
		<DocShell toc={blocks.flatMap((b, i) => (hasBlockHeader(b.blockType) ? [{ id: anchors[i], label: b.header }] : []))}>
			<ManualDocBody>
				<section className="space-y-3">
					<HideWhenEditing>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{manualModule.title}</p>
					</HideWhenEditing>
					<div className="flex items-center gap-3">
						<ManualTitleBlock kind="section" title={section.title} description={section.description} />
					</div>
				</section>
				<ManualBlockList container={container} blocks={blocks} anchors={anchors} />
			</ManualDocBody>
		</DocShell>
		</div>
		</ManualPageDraftProvider>
	)
}
