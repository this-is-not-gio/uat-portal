import TestCasesPage from "@/components/testsuite-layout/test-cases/test-cases-page";

// /test-cases/{round}/{section}: a section inside a testing round.
export default async function RoundSectionPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/test-cases/[section]/[child]">) {
	const [{ testSuiteSlug, section, child }, query] = await Promise.all([params, searchParams]);
	return <TestCasesPage testSuiteSlug={testSuiteSlug} path={[section, child]} query={query} />;
}
