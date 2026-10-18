import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DocShell } from "@/components/manual/doc-parts";
import { ReadOnlyBlockList } from "@/components/manual/manual-read-only-blocks";
import { can } from "@/lib/auth/permissions";
import { hasBlockHeader } from "@/lib/manual/blocks";
import { blockAnchors } from "@/lib/manual/slug";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getManualBlocks, getSuiteManualModuleBySlug } from "@/lib/supabase/manual";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

export default async function SuiteManualModulePage({ params }: PageProps<"/testsuite/[testSuiteSlug]/manual/[moduleSlug]">) {
	const { testSuiteSlug, moduleSlug } = await params;
	const testSuite = await getTestSuiteBySlug(testSuiteSlug);
	if (!testSuite) notFound();
	const manualModule = await getSuiteManualModuleBySlug(testSuite.id, moduleSlug);
	if (!manualModule) notFound();

	const [blocks, user] = await Promise.all([getManualBlocks({ moduleId: manualModule.id, sectionId: null }), getCurrentUser()]);
	const anchors = blockAnchors(blocks.map((b) => b.header));

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			<DocShell toc={blocks.flatMap((b, i) => (hasBlockHeader(b.blockType) ? [{ id: anchors[i], label: b.header }] : []))}>
				<section className="space-y-3">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Testing Manual</p>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-semibold tracking-tight">{manualModule.title}</h1>
						{!manualModule.isPublished && <Badge variant="outline">Unpublished</Badge>}
					</div>
					{manualModule.description && <p className="text-muted-foreground">{manualModule.description}</p>}
					{can(user, "admin_area") && (
						<Link href={`/manual/${manualModule.slug}`} className="text-xs font-medium underline underline-offset-4">Open in Testing Manual</Link>
					)}
				</section>
				<ReadOnlyBlockList blocks={blocks} anchors={anchors} />
			</DocShell>
		</div>
	);
}
