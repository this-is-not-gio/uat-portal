// Test Cases tab URLs: /testsuite/{suite}/test-cases/{section}, or {round}/{section} for a round's page.
export function testCasesHref(suiteSlug: string, ...path: string[]) {
	return `/testsuite/${suiteSlug}/test-cases/${path.join("/")}`;
}
