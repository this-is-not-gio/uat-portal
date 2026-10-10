import { notFound } from "next/navigation";
import OverviewTab from "@/components/testsuite-layout/overview/overview-tab";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSuiteOverview } from "@/lib/supabase/overview";
import { getTestRoleOptions } from "@/lib/supabase/organizations";
import { getSuiteEndpoints, getSuiteOverviewSections, getSuiteTestAccounts } from "@/lib/supabase/test-accounts";
import { getSuiteScope, getTestSuiteBySlug } from "@/lib/supabase/test-suite";

export default async function TestSuiteOverviewPage({ params }: PageProps<"/testsuite/[testSuiteSlug]/overview">) {
	const { testSuiteSlug } = await params;
	// Suite, user and scope are cache()'d, so these reuse the layout's lookups.
	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite) notFound();

	const isAuthor = can(currentUser, "author");
	const [scope, overview, testAccounts, overviewSections, endpoints, roleOptions] = await Promise.all([
		getSuiteScope(testSuite.id),
		getSuiteOverview(testSuite.id),
		getSuiteTestAccounts(testSuite.id),
		getSuiteOverviewSections(testSuite.id),
		getSuiteEndpoints(testSuite.id),
		// Only authors edit Test Accounts, so only they need the role picker.
		isAuthor ? getTestRoleOptions() : { internal: [], external: [] },
	]);

	return (
		<OverviewTab
			suite={testSuite}
			scope={scope}
			overview={overview}
			testAccounts={testAccounts}
			overviewSections={overviewSections}
			endpoints={endpoints}
			roleOptions={roleOptions}
			exitCriteria={testSuite.exitCriteria}
			canEdit={isAuthor && !["for_sign_off", "sign_off_issued", "signed_off", "archived"].includes(testSuite.status)}
			canEditCriteria={isAuthor && (testSuite.status === "draft" || testSuite.status === "ready")}
		/>
	);
}
