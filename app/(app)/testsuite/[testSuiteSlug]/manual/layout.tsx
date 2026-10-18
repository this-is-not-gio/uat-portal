import { notFound } from "next/navigation";
import { ManualSidebar } from "@/components/manual/manual-sidebar";
import { getSuiteManualModules } from "@/lib/supabase/manual";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// The suite's linked modules only, read-only: editing stays on the global /manual.
export default async function SuiteManualLayout({ children, params }: LayoutProps<"/testsuite/[testSuiteSlug]/manual">) {
	const { testSuiteSlug } = await params;
	const testSuite = await getTestSuiteBySlug(testSuiteSlug);
	if (!testSuite) notFound();
	const modules = await getSuiteManualModules(testSuite.id);

	return (
		<div className="flex min-h-full flex-row">
			<ManualSidebar modules={modules} baseHref={`/testsuite/${testSuiteSlug}/manual`} readOnly />
			{children}
		</div>
	);
}
