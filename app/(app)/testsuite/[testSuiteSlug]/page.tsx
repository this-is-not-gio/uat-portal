import { redirect } from "next/navigation";

// The suite root has no content of its own; Overview is the default tab.
export default async function TestSuite({ params }: PageProps<"/testsuite/[testSuiteSlug]">) {
	const { testSuiteSlug } = await params;
	redirect(`/testsuite/${testSuiteSlug}/overview`);
}
