import { redirect } from "next/navigation";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";

// Bare /test-results opens the "all" section, keeping any round/org lens.
export default async function TestResultsIndexPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/test-results">) {
	const [{ testSuiteSlug }, query] = await Promise.all([params, searchParams]);
	const pick = (key: string) => (typeof query[key] === "string" ? query[key] : undefined);
	redirect(testResultsHref(testSuiteSlug, "all", { iteration: pick("iteration"), org: pick("org") }));
}
