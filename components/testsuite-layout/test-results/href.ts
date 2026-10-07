// Test Results tab URLs: /testsuite/{suite}/test-results/{section}, "all" for every section.
// iteration / org pick the round and the participant whose rows are shown.
export function testResultsHref(suiteSlug: string, section = "all", query: { iteration?: string | number | null; org?: string | null } = {}) {
	const params = new URLSearchParams();
	if (query.iteration != null) params.set("iteration", String(query.iteration));
	if (query.org) params.set("org", query.org);
	const qs = params.toString();
	return `/testsuite/${suiteSlug}/test-results/${section}${qs ? `?${qs}` : ""}`;
}
