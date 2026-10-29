import { notFound, redirect } from "next/navigation";
import DefectsTable from "@/components/defects/defects-table";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDefects } from "@/lib/supabase/defects";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// Staff only (same rule as the layout's Defects tab); anyone else lands on Overview.
export default async function TestSuiteDefectsPage({ params }: PageProps<"/testsuite/[testSuiteSlug]/defects">) {
	const { testSuiteSlug } = await params;
	// Suite and user are cache()'d, so these reuse the layout's lookups.
	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite) notFound();
	if (!can(currentUser, "view_all_results")) redirect(`/testsuite/${testSuiteSlug}/overview`);

	// The current round: the running one, else the latest.
	const round = testSuite.iterations.find((i) => i.status === "in_progress")
		?? [...testSuite.iterations].sort((a, b) => b.iterationNumber - a.iterationNumber)[0];
	const defects = round ? await getDefects(testSuite.id, round.id) : [];

	return (
		<div className="flex flex-col gap-4 p-6">
			<div className="flex flex-col gap-0">
				<h2 className="text-lg font-semibold">Defects</h2>
				<p className="text-xs text-muted-foreground">{round ? `Logged in ${round.name}.` : "No testing round yet."}</p>
			</div>
			<DefectsTable defects={defects} />
		</div>
	);
}
