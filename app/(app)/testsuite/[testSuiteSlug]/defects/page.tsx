import { notFound, redirect } from "next/navigation";
import DefectsRoundSelect from "@/components/defects/defects-round-select";
import DefectsTable from "@/components/defects/defects-table";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDefects } from "@/lib/supabase/defects";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// Staff only (same rule as the layout's Defects tab); anyone else lands on Overview.
export default async function TestSuiteDefectsPage({ params, searchParams }: PageProps<"/testsuite/[testSuiteSlug]/defects">) {
	const [{ testSuiteSlug }, query] = await Promise.all([params, searchParams]);
	// Suite and user are cache()'d, so these reuse the layout's lookups.
	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite) notFound();
	if (!can(currentUser, "view_all_results")) redirect(`/testsuite/${testSuiteSlug}/overview`);

	// ?round= picks a round; otherwise the current one: the running round, else the latest.
	const rounds = [...testSuite.iterations].sort((a, b) => b.iterationNumber - a.iterationNumber);
	const requested = typeof query.round === "string" ? rounds.find((i) => i.id === query.round) : undefined;
	const round = requested ?? rounds.find((i) => i.status === "in_progress") ?? rounds[0];
	const defects = round ? await getDefects(testSuite.id, round.id) : [];

	return (
		<div className="flex flex-col gap-4 p-6">
			<div className="flex items-end justify-between gap-4">
				<div className="flex flex-col gap-0">
					<h2 className="text-lg font-semibold">Defects</h2>
					<p className="text-xs text-muted-foreground">{round ? `Logged in ${round.name}.` : "No testing round yet."}</p>
				</div>
				{round && <DefectsRoundSelect rounds={rounds.map((r) => ({ id: r.id, name: r.name }))} value={round.id} />}
			</div>
			<DefectsTable key={round?.id} defects={defects} />
		</div>
	);
}
