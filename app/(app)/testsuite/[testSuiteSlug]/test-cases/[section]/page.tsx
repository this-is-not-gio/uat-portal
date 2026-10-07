import { notFound } from "next/navigation";
import TestCasesTab from "@/components/testsuite-layout/test-cases/test-cases-tab";
import TesterTestCasesTab from "@/components/testsuite-layout/test-cases/tester-test-cases-tab";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// /test-cases/{section}, or /test-cases/{round} for a round's overview.
export default async function SectionPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/test-cases/[section]">) {
	const [{ testSuiteSlug, section }, query] = await Promise.all([params, searchParams]);
	const iteration = typeof query.iteration === "string" ? query.iteration : undefined;
	const org = typeof query.org === "string" ? query.org : undefined;

	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite || !currentUser) notFound();

	const isTester = currentUser.role === "Internal" || currentUser.role === "External";
	// Testers can't see a suite before testing starts.
	if (isTester && (testSuite.status === "draft" || testSuite.status === "ready")) notFound();

	return isTester ? (
		<TesterTestCasesTab
			testSuiteId={testSuite.id}
			testSuiteSlug={testSuite.slug}
			suiteName={testSuite.name}
			suiteStatus={testSuite.status}
			sectionSlug={section}
			iterationNumber={iteration}
			orgId={org}
			currentUser={currentUser}
		/>
	) : (
		<TestCasesTab
			testSuiteId={testSuite.id}
			testSuiteSlug={testSuite.slug}
			suiteName={testSuite.name}
			suiteStatus={testSuite.status}
			sectionPath={[section]}
		/>
	);
}
