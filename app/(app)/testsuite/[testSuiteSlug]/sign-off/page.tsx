import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SignOffTab from "@/components/testsuite-layout/sign-off/sign-off-tab";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDraftSignOff, getSuiteSignOffs } from "@/lib/supabase/overview";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// Also the default file name of the PDF saved from Download PDF.
export async function generateMetadata({ params }: PageProps<"/testsuite/[testSuiteSlug]/sign-off">): Promise<Metadata> {
	const testSuite = await getTestSuiteBySlug((await params).testSuiteSlug);
	return { title: testSuite ? `${testSuite.name} – Sign-off report` : "Sign-off report" };
}

// ?signOff= picks one of the suite's sign-offs; without it, the current (not withdrawn) one opens.
export default async function TestSuiteSignOffPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/sign-off">) {
	const [{ testSuiteSlug }, query] = await Promise.all([params, searchParams]);
	// Suite and user are cache()'d, so these reuse the layout's lookups.
	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite) notFound();

	// Same rule as the layout's Sign-off tab: staff only, once a sign-off with a frozen report exists
	// (withdrawn ones included), or the vendor's draft while the suite is For Sign-off. Anyone else lands on Overview.
	const canView = can(currentUser, "view_all_results") && testSuite.status !== "draft" && testSuite.status !== "ready";
	const [signOffs, draft] = await Promise.all([
		canView ? getSuiteSignOffs(testSuite.id).then((all) => all.filter((s) => s.hasReport)) : [],
		testSuite.status === "for_sign_off" && can(currentUser, "issue_sign_off") ? getDraftSignOff(testSuite.id) : null,
	]);
	if (signOffs.length === 0 && !draft) redirect(`/testsuite/${testSuiteSlug}/overview`);

	// The draft opens by default; ?signOff= still picks an earlier issued one.
	const requested = typeof query.signOff === "string" ? query.signOff : undefined;
	const selectedId = signOffs.find((s) => s.id === requested)?.id
		?? (draft ? null : signOffs.find((s) => !s.revokedAt)?.id ?? signOffs[0].id);

	return <SignOffTab suiteId={testSuite.id} suiteSlug={testSuiteSlug} signOffs={signOffs} selectedId={selectedId} draft={draft} />;
}
