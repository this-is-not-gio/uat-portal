import { notFound, redirect } from "next/navigation";
import TestResultsTab from "@/components/testsuite-layout/test-results/test-results-tab";
import { testCasesHref } from "@/components/testsuite-layout/test-cases/href";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// /test-results/{section}: one round's results ("all" for every section), round and org from the query.
export default async function TestResultsSectionPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/test-results/[section]">) {
	const [{ testSuiteSlug, section }, query] = await Promise.all([params, searchParams]);
	const iteration = typeof query.iteration === "string" ? query.iteration : undefined;
	const org = typeof query.org === "string" ? query.org : undefined;

	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite || !currentUser) notFound();

	// Testers' round results live in Test Cases.
	const isTester = currentUser.role === "Internal" || currentUser.role === "External";
	if (isTester) {
		const qs = new URLSearchParams({ ...(iteration ? { iteration } : {}), ...(org ? { org } : {}) }).toString();
		redirect(`${testCasesHref(testSuiteSlug, "all")}${qs ? `?${qs}` : ""}`);
	}
	// Same rule as the tab: nothing to show until testing starts.
	if (testSuite.status === "draft" || testSuite.status === "ready") redirect(`/testsuite/${testSuiteSlug}/overview`);

	return (
		<TestResultsTab
			testSuiteId={testSuite.id}
			testSuiteSlug={testSuite.slug}
			suiteName={testSuite.name}
			suiteStatus={testSuite.status}
			sectionSlug={section}
			iterationNumber={iteration}
			orgId={org}
		/>
	);
}
