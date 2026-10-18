import { notFound } from "next/navigation";
import Link from "next/link";
import { DocShell } from "@/components/manual/doc-parts";
import { ReadOnlyBlockList } from "@/components/manual/manual-read-only-blocks";
import { can } from "@/lib/auth/permissions";
import { hasBlockHeader } from "@/lib/manual/blocks";
import { blockAnchors } from "@/lib/manual/slug";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getManualBlocks, getSuiteManualModuleBySlug } from "@/lib/supabase/manual";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

export default async function SuiteManualSectionPage({ params }: PageProps<"/testsuite/[testSuiteSlug]/manual/[moduleSlug]/[sectionSlug]">) {
	const { testSuiteSlug, moduleSlug, sectionSlug } = await params;
	const testSuite = await getTestSuiteBySlug(testSuiteSlug);
	if (!testSuite) notFound();
	const manualModule = await getSuiteManualModuleBySlug(testSuite.id, moduleSlug);
	const section = manualModule?.sections.find((s) => s.slug === sectionSlug);
	if (!manualModule || !section) notFound();

	const [blocks, user] = await Promise.all([getManualBlocks({ moduleId: manualModule.id, sectionId: section.id }), getCurrentUser()]);
	const anchors = blockAnchors(blocks.map((b) => b.header));

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			<DocShell toc={blocks.flatMap((b, i) => (hasBlockHeader(b.blockType) ? [{ id: anchors[i], label: b.header }] : []))}>
				<section className="space-y-3">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{manualModule.title}</p>
					<h1 className="text-2xl font-semibold tracking-tight">{section.title}</h1>
					{section.description && <p className="text-muted-foreground">{section.description}</p>}
					{can(user, "admin_area") && (
						<Link href={`/manual/${manualModule.slug}/${section.slug}`} className="text-xs font-medium underline underline-offset-4">Open in Testing Manual</Link>
					)}
				</section>
				<ReadOnlyBlockList blocks={blocks} anchors={anchors} />
			</DocShell>
		</div>
	);
}
