import { redirect } from "next/navigation";
import { testCasesHref } from "@/components/testsuite-layout/test-cases/href";

// Bare /test-cases opens the "all" section, keeping any round/org lens.
export default async function TestCasesIndexPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/test-cases">) {
	const [{ testSuiteSlug }, query] = await Promise.all([params, searchParams]);
	const keep = new URLSearchParams();
	for (const key of ["iteration", "org"]) {
		const value = query[key];
		if (typeof value === "string") keep.set(key, value);
	}
	const qs = keep.toString();
	redirect(`${testCasesHref(testSuiteSlug, "all")}${qs ? `?${qs}` : ""}`);
}
