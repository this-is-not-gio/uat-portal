import { requireUser } from "@/lib/supabase/auth";
import { getSidebarSuites, type suiteStatus } from "@/lib/supabase/Init";
import { statusMapping } from "@/components/testsuite-layout/suite-status-badge";
import { cn } from "@/lib/utils";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActiveRounds, getRecentResults, getRoundsAwaitingSignOff, getSignOffsAwaitingAck } from "@/lib/supabase/test-iterations";
import { CircleAlert, CircleCheck, ClipboardList, Clock, FileSignature, Hourglass, Send } from "lucide-react";
import Link from "next/link";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";

// Local copy of the TestStatusMapping colours: that map lives in a "use client" file, which a Server Component can't read values from.
const RESULT_TONE: Record<string, string> = { Passed: "text-green-700", Failed: "text-destructive", Blocked: "text-amber-700" };

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Archived is left out on purpose: the row tracks suites still moving through the lifecycle.
const PIPELINE: suiteStatus[] = ["draft", "ready", "in_testing", "sign_off_issued", "signed_off"];

const TAGLINES: Partial<Record<suiteStatus, string>> = {
	draft: "Still on the drawing board",
	ready: "Locked, loaded, waiting for testers",
	in_testing: "Bug hunt in progress",
	sign_off_issued: "Ball's in the client's court",
	signed_off: "Shipped it!",
};

export default async function DashboardPage() {
	const user = await requireUser();
	// Same cached call as the sidebar in the layout, so no extra round trip.
	const suites = await getSidebarSuites(user);
	const pipelineTotal = suites.filter((suite) => PIPELINE.includes(suite.status)).length;
	// Draft first, then Ready: the ones furthest from testing lead.
	const drafts = suites
		.filter((suite) => suite.status === "draft" || suite.status === "ready")
		.sort((a, b) => (a.status === b.status ? 0 : a.status === "draft" ? -1 : 1));
	const [activeRounds, awaitingSignOff, awaitingAck, recentResults] = user.role === "Admin"
		? await Promise.all([getActiveRounds(), getRoundsAwaitingSignOff(), getSignOffsAwaitingAck(), getRecentResults()])
		: [[], [], [], []];
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const daysSince = (value: string) => Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);

	// Needs attention: one item per thing the vendor should act on, most urgent kind first.
	const runningSlugs = new Set(activeRounds.map((round) => round.suiteSlug));
	const attention = [
		...activeRounds
			.filter((round) => round.iteration.plannedEndDate != null && round.iteration.plannedEndDate < today)
			.map((round) => ({ key: `overdue-${round.iteration.id}`, Icon: Clock, tone: "text-destructive", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `${round.iteration.name} is past its planned end (${formatDate(round.iteration.plannedEndDate!)})` })),
		...activeRounds
			.filter((round) => round.failedCount > 0)
			.map((round) => ({ key: `failed-${round.iteration.id}`, Icon: CircleAlert, tone: "text-destructive", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `${round.failedCount} Failed/Blocked ${round.failedCount === 1 ? "case" : "cases"} in ${round.iteration.name}` })),
		...activeRounds
			.filter((round) => round.totalOrgs > 0 && round.submittedOrgs === round.totalOrgs)
			.map((round) => ({ key: `complete-${round.iteration.id}`, Icon: CircleCheck, tone: "text-emerald-600", suite: round.suiteName, href: testResultsHref(round.suiteSlug, "all", { iteration: round.iteration.iterationNumber }), text: `Every org submitted ${round.iteration.name}, ready to complete` })),
		...awaitingSignOff
			.filter((round) => !runningSlugs.has(round.suiteSlug))
			.map((round) => ({ key: `signoff-${round.iteration.id}`, Icon: FileSignature, tone: "text-amber-600", suite: round.suiteName, href: `/testingsuite/${round.suiteSlug}?tab=sign-off`, text: `${round.iteration.name} completed, sign-off not issued yet` })),
		...awaitingAck.map((signOff) => {
			const days = daysSince(signOff.signedOffAt);
			return { key: `ack-${signOff.id}`, Icon: Hourglass, tone: "text-muted-foreground", suite: signOff.suiteName, href: `/testingsuite/${signOff.suiteSlug}?tab=sign-off`, text: `Sign-off${signOff.iterationName ? ` for ${signOff.iterationName}` : ""} awaiting client acknowledgement, ${days === 0 ? "issued today" : `${days} ${days === 1 ? "day" : "days"} waiting`}` };
		}),
	];

	// Tester view: rounds their org is in, split by whether the org has submitted yet.
	// Planned (not_started) rounds already list their participants, but can't be tested yet.
	const myRunning = suites.filter((suite) => suite.openRound?.status === "in_progress" && suite.mine.inOpenRound);
	const toTest = myRunning.filter((suite) => !suite.mine.submittedAt);
	const submitted = myRunning.filter((suite) => suite.mine.submittedAt);
	const casesLeft = toTest.reduce((sum, suite) => sum + suite.mine.remaining, 0);
	const testerStats = [
		{ label: "Rounds to test", value: toTest.length, unit: toTest.length === 1 ? "round" : "rounds", Icon: ClipboardList, tagline: "Waiting on your org" },
		{ label: "Cases left", value: casesLeft, unit: casesLeft === 1 ? "case" : "cases", Icon: Clock, tagline: "Across every open round" },
		{ label: "Submitted", value: submitted.length, unit: submitted.length === 1 ? "round" : "rounds", Icon: Send, tagline: "Handed in, round still open" },
	];

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
			<div className="px-4 pt-6 sm:px-6">
				<p className="text-xl font-bold sm:text-2xl font-heading">Hello, {user.fullName}</p>
				<p className="text-xs text-muted-foreground">
					{user.role === "Admin"
						? "Your testing command center — see which rounds are moving, who's submitted, and what's ready for sign-off."
						: "Your turn to put it through its paces. Pick up where you left off and make every click count."}
				</p>
			</div>
			<div className="px-4 pb-6 sm:px-6">
				{user.role === "Admin" && (
					<section className="flex flex-col gap-2">
						<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<h2 className="text-xs font-medium">User Acceptance Testing</h2>
							<p className="text-xs text-muted-foreground">
								{pipelineTotal} {pipelineTotal === 1 ? "suite" : "suites"} on the move
							</p>
						</div>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
							{PIPELINE.map((status) => {
								const { Icon, label, className, IconColor } = statusMapping[status];
								const count = suites.filter((suite) => suite.status === status).length;
								return (
									<Card
										key={status}
										size="sm"
										className={cn(
											"md:last:col-span-2 xl:last:col-span-1 transition-[translate,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md",
											count === 0 && "opacity-60",
										)}
									>
										<CardHeader>
											<CardDescription className="text-xs font-medium">{label}</CardDescription>
											<CardTitle className=" font-bold font-mono tabular-nums">
												<div className="flex flex-wrap items-baseline gap-x-2 px-1 text-3xl">
													{count}
													<span className="text-xs text-muted-foreground font-normal">{count === 1 ? "suite" : "suites"}</span>
												</div>
											</CardTitle>
											<CardAction>
												<div className={cn("rounded-lg border p-2 transition-transform duration-200 motion-safe:group-hover/card:-rotate-12 motion-safe:group-hover/card:scale-110", className)}>
													<Icon className={cn("size-4", IconColor)} />
												</div>
											</CardAction>
										</CardHeader>
										<CardContent className="flex flex-col gap-2">
											{/* <Progress
												value={pipelineTotal ? Math.round((count / pipelineTotal) * 100) : 0}
												aria-label={`${label} share of suites`}
												className={cn(IconColor, "[&_[data-slot=progress-indicator]]:bg-current")}
											/> */}
											<p className="text-xs text-muted-foreground">{TAGLINES[status]}</p>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</section>
				)}
				{user.role === "Admin" && (
					<Card size="sm" className="mt-4">
						<CardHeader>
							<CardTitle className="text-sm">Active rounds</CardTitle>
							<CardDescription className="text-xs">
								{activeRounds.length} {activeRounds.length === 1 ? "round" : "rounds"} running
							</CardDescription>
						</CardHeader>
						<CardContent>
							{activeRounds.length === 0 ? (
								<p className="text-xs text-muted-foreground">No rounds running right now.</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Suite</TableHead>
											<TableHead>Round</TableHead>
											<TableHead>Started</TableHead>
											<TableHead>Planned end</TableHead>
											<TableHead className="w-48">Progress</TableHead>
											<TableHead className="text-right">Orgs submitted</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{activeRounds.map((round) => {
											const { iteration } = round;
											// planned_end_date is a plain date, so compare as YYYY-MM-DD strings.
											const overdue = iteration.plannedEndDate != null && iteration.plannedEndDate < today;
											const percent = round.includedCount ? Math.round((round.testedCount / round.includedCount) * 100) : 0;
											return (
												<TableRow key={iteration.id}>
													<TableCell className="font-medium">
														<Link href={`/testingsuite/${round.suiteSlug}`} className="hover:underline">
															{round.suiteCode && <span className="mr-1 font-mono text-muted-foreground">{round.suiteCode}</span>}
															{round.suiteName}
														</Link>
													</TableCell>
													<TableCell>{iteration.name}</TableCell>
													<TableCell>{formatDate(iteration.startedAt)}</TableCell>
													<TableCell className={cn(overdue && "font-medium text-destructive")}>
														{iteration.plannedEndDate ? formatDate(iteration.plannedEndDate) : "—"}
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-2">
															<Progress value={percent} aria-label={`${iteration.name} progress`} className="flex-1" />
															<span className="font-mono text-xs tabular-nums text-muted-foreground">
																{round.testedCount}/{round.includedCount}
															</span>
														</div>
													</TableCell>
													<TableCell className="text-right font-mono tabular-nums">
														{round.submittedOrgs}/{round.totalOrgs}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				)}
				{user.role === "Admin" && (
					<Card size="sm" className="mt-4">
						<CardHeader>
							<CardTitle className="text-sm">Needs attention</CardTitle>
							<CardDescription className="text-xs">
								{attention.length} {attention.length === 1 ? "item" : "items"} waiting on you
							</CardDescription>
						</CardHeader>
						<CardContent>
							{attention.length === 0 ? (
								<p className="text-xs text-muted-foreground">All clear. Nothing needs you right now.</p>
							) : (
								<ul className="flex flex-col divide-y">
									{attention.map(({ key, Icon, tone, suite, href, text }) => (
										<li key={key}>
											<Link href={href} className="flex items-center gap-3 py-2 text-xs hover:bg-muted/50">
												<Icon className={cn("size-4 shrink-0", tone)} />
												<span className="font-medium">{suite}</span>
												<span className="text-muted-foreground">{text}</span>
											</Link>
										</li>
									))}
								</ul>
							)}
						</CardContent>
					</Card>
				)}
				{user.role === "Admin" && (
					<Card size="sm" className="mt-4">
						<CardHeader>
							<CardTitle className="text-sm">Drafts to finish</CardTitle>
							<CardDescription className="text-xs">
								{drafts.length} {drafts.length === 1 ? "suite" : "suites"} not yet in testing
							</CardDescription>
						</CardHeader>
						<CardContent>
							{drafts.length === 0 ? (
								<p className="text-xs text-muted-foreground">No drafts. Everything is out the door.</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Suite</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Sections</TableHead>
											<TableHead className="text-right">Test cases</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{drafts.map((suite) => {
											const { Icon, label, IconColor } = statusMapping[suite.status];
											return (
												<TableRow key={suite.id}>
													<TableCell className="font-medium">
														<Link href={`/testingsuite/${suite.slug}?tab=test-cases`} className="hover:underline">
															{suite.code && <span className="mr-1 font-mono text-muted-foreground">{suite.code}</span>}
															{suite.title}
														</Link>
													</TableCell>
													<TableCell>
														<span className="inline-flex items-center gap-1 text-xs">
															<Icon className={cn("size-3.5", IconColor)} />
															{label}
														</span>
													</TableCell>
													<TableCell className="text-right font-mono tabular-nums">{suite.adminCounts?.sections ?? "—"}</TableCell>
													<TableCell className="text-right font-mono tabular-nums">{suite.adminCounts?.testCaseCount ?? "—"}</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				)}
				{user.role === "Admin" && (
					<Card size="sm" className="mt-4">
						<CardHeader>
							<CardTitle className="text-sm">Recent activity</CardTitle>
							<CardDescription className="text-xs">Latest test results across all rounds</CardDescription>
						</CardHeader>
						<CardContent>
							{recentResults.length === 0 ? (
								<p className="text-xs text-muted-foreground">No results yet.</p>
							) : (
								<ul className="flex flex-col divide-y">
									{recentResults.map((result) => (
										<li key={result.id}>
											<Link href={testResultsHref(result.suiteSlug)} className="flex flex-wrap items-baseline gap-x-2 py-2 text-xs hover:bg-muted/50">
												<span className="font-medium">{result.organizationName ?? result.executorName ?? "Someone"}</span>
												<span className={cn("font-medium", RESULT_TONE[result.status] ?? "text-muted-foreground")}>
													{result.status.toLowerCase()}
												</span>
												<span>
													{result.code && <span className="mr-1 font-mono text-muted-foreground">{result.code}</span>}
													{result.title}
												</span>
												<span className="text-muted-foreground">
													· {result.suiteName}, {result.iterationName}
													{result.executorName && result.organizationName ? ` · by ${result.executorName}` : ""}
												</span>
												<span className="ml-auto text-muted-foreground">{formatDate(result.completedAt)}</span>
											</Link>
										</li>
									))}
								</ul>
							)}
						</CardContent>
					</Card>
				)}
				{user.role !== "Admin" && (
					<div className="flex flex-col gap-4">
						<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
							{testerStats.map(({ label, value, unit, Icon, tagline }) => (
								<Card key={label} size="sm" className={cn(value === 0 && "opacity-60")}>
									<CardHeader>
										<CardDescription className="text-xs font-medium">{label}</CardDescription>
										<CardTitle className="font-bold font-mono tabular-nums">
											<div className="flex flex-wrap items-baseline gap-x-2 px-1 text-3xl">
												{value}
												<span className="text-xs text-muted-foreground font-normal">{unit}</span>
											</div>
										</CardTitle>
										<CardAction>
											<div className="rounded-lg border p-2">
												<Icon className="size-4 text-muted-foreground" />
											</div>
										</CardAction>
									</CardHeader>
									<CardContent>
										<p className="text-xs text-muted-foreground">{tagline}</p>
									</CardContent>
								</Card>
							))}
						</div>
						<Card size="sm">
							<CardHeader>
								<CardTitle className="text-sm">Continue testing</CardTitle>
								<CardDescription className="text-xs">Open rounds your org hasn&apos;t submitted yet</CardDescription>
							</CardHeader>
							<CardContent>
								{toTest.length === 0 ? (
									<p className="text-xs text-muted-foreground">Nothing to test right now.</p>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Suite</TableHead>
												<TableHead>Round</TableHead>
												<TableHead>Planned end</TableHead>
												<TableHead className="text-right">Remaining</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{toTest.map((suite) => {
												const round = suite.openRound!;
												const overdue = round.plannedEnd != null && round.plannedEnd < today;
												return (
													<TableRow key={suite.id}>
														<TableCell className="font-medium">
															<Link href={`/testingsuite/${suite.slug}/all?tab=test-cases`} className="hover:underline">
																{suite.code && <span className="mr-1 font-mono text-muted-foreground">{suite.code}</span>}
																{suite.title}
															</Link>
														</TableCell>
														<TableCell>Round {round.number}: {round.name}</TableCell>
														<TableCell className={cn(overdue && "font-medium text-destructive")}>
															{round.plannedEnd ? formatDate(round.plannedEnd) : "—"}
														</TableCell>
														<TableCell className="text-right font-mono tabular-nums">{suite.mine.remaining}</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
						{submitted.length > 0 && (
							<Card size="sm">
								<CardHeader>
									<CardTitle className="text-sm">Submitted, round still open</CardTitle>
									<CardDescription className="text-xs">Need to change something? Withdraw the submission from the suite to reopen it.</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="flex flex-col divide-y">
										{submitted.map((suite) => (
											<li key={suite.id}>
												<Link href={`/testingsuite/${suite.slug}/all?tab=test-cases`} className="flex flex-wrap items-baseline gap-x-2 py-2 text-xs hover:bg-muted/50">
													<Send className="size-3.5 self-center text-muted-foreground" />
													<span className="font-medium">{suite.title}</span>
													<span className="text-muted-foreground">Round {suite.openRound!.number}: {suite.openRound!.name}</span>
													<span className="ml-auto text-muted-foreground">Submitted {formatDate(suite.mine.submittedAt!)}</span>
												</Link>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
