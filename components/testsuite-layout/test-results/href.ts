// Test Results tab URLs: /testsuite/{suite}/test-results/{section}, "all" for every section.
// iteration / org pick the round and the participant whose rows are shown; view ("overall" | "submitted")
// and tester pick the Submitted Test Results lens.
export function testResultsHref(suiteSlug: string, section = "all", query: { iteration?: string | number | null; org?: string | null; view?: string | null; tester?: string | null } = {}) {
	const params = new URLSearchParams();
	if (query.iteration != null) params.set("iteration", String(query.iteration));
	if (query.org) params.set("org", query.org);
	if (query.view) params.set("view", query.view);
	if (query.tester) params.set("tester", query.tester);
	const qs = params.toString();
	return `/testsuite/${suiteSlug}/test-results/${section}${qs ? `?${qs}` : ""}`;
}
