import { format, parseISO } from "date-fns";
import { notFound, redirect } from "next/navigation";
import DefectsRoundSelect from "@/components/defects/defects-round-select";
import { CircleCheck, CircleDot, ClipboardPen, Feather, Flame, Hourglass, Zap } from "lucide-react";
import { SummaryCard } from "@/components/testsuite-layout/shared/summary-card";
import DefectsTable from "@/components/defects/defects-table";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getAwaitingDefectCount, getDefects } from "@/lib/supabase/defects";
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
	const awaiting = round ? await getAwaitingDefectCount(round.id, defects) : 0;
	const open = defects.filter((d) => d.status === "open").length;
	// Resolved and won't-fix both count as closed.
	const closed = defects.length - open;

	// Only counts with something to act on are shown.
	const statusChips = [
		{ count: awaiting, label: "Awaiting Defects", icon: ClipboardPen, tone: "bg-stone-100 border-stone-400/40 text-stone-700" },
		{ count: open, label: "Open Defects", icon: CircleDot, tone: "bg-emerald-50 border-emerald-600/30 text-emerald-700" },
		{ count: closed, label: "Closed Defects", icon: CircleCheck, tone: "bg-purple-50 border-purple-600/30 text-purple-700" },
	].filter((chip) => chip.count > 0);

	return (
		<div className="flex flex-col gap-4 p-6">
			<div className="flex flex-row items-center justify-between gap-4">
				<div className="flex flex-col gap-2">
					{statusChips.length > 0 && (
						<>
							<p className="font-medium text-xs">Defects Summary</p>
							<div className="flex flex-row flex-wrap items-center gap-2">
								{statusChips.map(({ count, label, icon: Icon, tone }) => (
									<div key={label} className={`px-2 py-1 rounded-md flex flex-row gap-1 items-center border ${tone}`}>
										<Icon size={15} />
										<p className="font-mono text-xs">{count}</p>
										<p className="text-xs font-medium">{label}</p>
									</div>
								))}
							</div>
						</>
					)}
				</div>
				{round && <DefectsRoundSelect rounds={rounds.map((r) => ({ id: r.id, name: r.name }))} value={round.id} />}
			</div>
			<div className="flex flex-col gap-2">
				<p className="font-medium text-xs">Reported Defects Severity Overview</p>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
					<SummaryCard label="Critical Defects" count={defects.filter((d) => d.severity === "critical").length} unit="Defects" icon={<Flame className="text-red-800" />} iconClassName="bg-red-50/50 border-red-800" />
					<SummaryCard label="High Defects" count={defects.filter((d) => d.severity === "high").length} unit="Defects" icon={<Zap className="text-orange-800" />} iconClassName="bg-orange-50/50 border-orange-800" />
					<SummaryCard label="Medium Defects" count={defects.filter((d) => d.severity === "medium").length} unit="Defects" icon={<Hourglass className="text-amber-800" />} iconClassName="bg-yellow-50/50 border-amber-800" />
					<SummaryCard label="Low Defects" count={defects.filter((d) => d.severity === "low").length} unit="Defects" icon={<Feather className="text-stone-700" />} />
				</div>
			</div>
			<DefectsTable key={round?.id} defects={defects} suiteSlug={testSuite.slug} iterationNumber={round?.iterationNumber ?? null} />

			{/* <div className="flex items-end justify-between gap-4">
				<div className="flex flex-col gap-0">
					<h2 className="text-lg font-semibold">Defects</h2>
					<p className="text-xs text-muted-foreground">{round ? `Logged in ${round.name}.` : "No testing round yet."}</p>
				</div>
				{round && <DefectsRoundSelect rounds={rounds.map((r) => ({ id: r.id, name: r.name }))} value={round.id} />}
			</div>
			<DefectsTable key={round?.id} defects={defects} suiteSlug={testSuite.slug} iterationNumber={round?.iterationNumber ?? null} /> */}
		</div>
	);
}
