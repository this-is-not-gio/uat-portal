import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSuiteManualModules } from "@/lib/supabase/manual";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

export default async function SuiteManualPage({ params }: PageProps<"/testsuite/[testSuiteSlug]/manual">) {
	const { testSuiteSlug } = await params;
	const [testSuite, user] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite) notFound();
	const modules = await getSuiteManualModules(testSuite.id);
	if (modules.length > 0) redirect(`/testsuite/${testSuiteSlug}/manual/${modules[0].slug}`);
	if (!can(user, "author")) notFound();

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
			<p className="text-sm font-medium">No manuals linked</p>
			<p className="text-xs text-muted-foreground">Use More → Link Manual.</p>
		</div>
	);
}
