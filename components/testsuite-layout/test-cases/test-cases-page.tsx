import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";
import TestCasesTab from "./test-cases-tab";
import TesterTestCasesTab from "./tester-test-cases-tab";

type query = Record<string, string | string[] | undefined>;

// Shared by the test-cases routes. path: [section] or [round, section].
export default async function TestCasesPage({ testSuiteSlug, path, query }: { testSuiteSlug: string; path: string[]; query: query }) {
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
			sectionSlug={path[0]}
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
			sectionPath={path}
		/>
	);
}
