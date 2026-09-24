import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
	ClipboardList,
	LayoutDashboard,
	ListChecks,
	Activity,
	Paperclip,
	LucideIcon,
	CircleCheckBig,
	CircleDashed,
	Circle,
} from "lucide-react";
import { EpicWorkspace } from "@/components/epic-workspace";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getTestSuite } from "@/lib/supabase/test-suite";
import PageTab from "../page-tab";
import TestCasesTab from "../test-cases-tab";
import TestResultTab from "../test-result-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SuiteStatusButton, { READINESS_ISSUES } from "../components/suite-status-button";
import SuiteDialog from "@/components/suite-dialog";
import { Pencil } from "lucide-react";
import StartIterationDialog from "../components/start-iteration-dialog";
import SignOffDialog from "../components/sign-off-dialog";
import { getSignOffContext, getSuiteOverview } from "@/lib/supabase/overview";
import OverviewTab from "../overview-tab";
import OverviewTabSkeleton from "../overview-tab-skeleton";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";



type testingsuiteLifeCycle = "draft" | "ready" | "in_testing" | "signed_off" | "archived";

const statusMapping: Record<testingsuiteLifeCycle, { Icon: LucideIcon, label: string, className: string, nextStatusIcon: LucideIcon | null }> = {
	draft: { Icon: ClipboardList, label: "Drafting", className: "bg-gray-500/10 border-gray-800/50 text-gray-800", nextStatusIcon: CircleCheckBig },
	ready: { Icon: CircleCheckBig, label: "For Testing", className: "bg-green-500/10 border-green-800/50 text-green-800", nextStatusIcon: ListChecks },
	in_testing: { Icon: ListChecks, label: "In Testing", className: "bg-blue-500/10 border-blue-800/50 text-blue-800", nextStatusIcon: Activity },
	signed_off: { Icon: Activity, label: "Signed Off", className: "bg-purple-500/20 border-purple-800/50 text-purple-800", nextStatusIcon: Paperclip },
	archived: { Icon: Paperclip, label: "Archived", className: "bg-red-500/20 border-red-800/50 text-red-800", nextStatusIcon: ClipboardList },

};

// Friendly titles/descriptions for the same rule suite-status-button.tsx
// enforces (READINESS_ISSUES) — every draft suite needs these before it can
// go Ready.
const READINESS_REQUIREMENTS: { key: keyof typeof READINESS_ISSUES; title: string; description: string }[] = [
	{ key: "no_test_cases", title: "Has test cases", description: "The suite needs at least one test case." },
	{ key: "no_steps", title: "Steps defined", description: "Every test case needs at least one step to execute." },
	{ key: "step_without_expected_result", title: "Expected results", description: "Every step needs at least one expected result, so testers know what a pass looks like." },
];



const currentTestingSuiteStatus = {
	status: "ready" as testingsuiteLifeCycle,
}

export default async function TestsuitePage({
	params,
	searchParams,
}: {
	params: Promise<{ testingSuiteSlug: string; section?: string[] }>;
	searchParams: Promise<{ tab?: string; iteration?: string }>;
}) {
	const { testingSuiteSlug, section } = await params;
	const { tab, iteration } = await searchParams;
	const sectionSlug = section?.[0];
	const testSuite = await getTestSuite({ slug: testingSuiteSlug });
	if (!testSuite) notFound();
	// Only needed for the Sign Off button.
	const signOffContext = testSuite.status === "in_testing" ? await getSignOffContext(testSuite.id) : null;
	const Icon = statusMapping[testSuite.status].Icon;
	const NextIcon = statusMapping[testSuite.status].nextStatusIcon

	const overviewTabSlot =
		!tab || tab === "overview" ?
			<Suspense fallback={<OverviewTabSkeleton />}>
				<OverviewContent suite={testSuite} />
			</Suspense>
			: null

	const testCasesTabSlot =
		tab === "test-cases" ?
			<TestCasesTab testSuiteId={testSuite.id} testSuiteSlug={testingSuiteSlug} suiteStatus={testSuite.status} sectionSlug={sectionSlug} />
			: null

	const testResultsTabSlot =
		tab === "test-results" ?
			<TestResultTab testSuiteId={testSuite.id} testSuiteSlug={testingSuiteSlug} suiteName={testSuite.name} suiteStatus={testSuite.status} sectionSlug={sectionSlug} iterationNumber={iteration} />
			: null

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="px-6 flex flex-row items-center justify-between">
				<div className="">
					<div className="flex flex-row items-center gap-2">
						<h1 className="font-heading font-semibold">{testSuite.name}</h1>
						<Badge variant="outline" className={`text-xs border font-heading rounded-md ${statusMapping[testSuite.status].className}`}>
							<Icon className="h-3 w-3" />
							{statusMapping[testSuite.status].label}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground">Testing Suite</p>
				</div>
				<div className="">
					{
						testSuite.status === "draft" ? (
							<div className=" ">
								{/* <SuiteStatusButton suiteId={testSuite.id} targetStatus="ready">
									{NextIcon && <NextIcon className="h-4 w-4" />}
									<p className="text-xs">Mark as Ready</p>
								</SuiteStatusButton> */}
								<div className="flex flex-row items-end gap-2">


									<HoverCard>
										<HoverCardTrigger render={
											<div className="flex flex-row items-center gap-2">
												<div className="flex flex-col items-end">
													<p className="font-semibold text-sm">Test suite is not Ready</p>
													<p className="text-xs text-muted-foreground">
														This suite is still a draft and cannot be mark as ready
													</p>
												</div>
												<div className="flex flex-row items-center justify-center size-10 bg-gray-500/10 border border-gray-800/50 rounded-md">
													<CircleDashed className="size-4 text-gray-500" />
												</div>
											</div>
										} />
										<HoverCardContent className="w-80 mt-2 px-4 py-3" side="bottom">
											<div className="flex flex-col gap-2">
												<div className="flex flex-col">
													<p className="font-semibold text-sm">Test Suite is not ready</p>
													<p className="text-xs text-muted-foreground">
														This suite is still a Draft — testers can&apos;t see it yet. Here&apos;s what&apos;s left before you can mark it Ready:
													</p>
												</div>
												<div className="flex flex-col gap-1">
													{READINESS_REQUIREMENTS.map((requirement) => (
														<div key={requirement.key} className="flex flex-row items-start gap-2 p-2">
															<Circle className="size-4 shrink-0 text-gray-500 mt-0.5" />
															<div className="">
																<p className="font-medium text-sm">{requirement.title}</p>
																<p className="text-xs text-muted-foreground">{requirement.description}</p>
															</div>
														</div>
													))}
												</div>
												<div className="flex items-center gap-2">
													<p className="text-xs text-muted-foreground">
														Once every test case clears these, hit Mark as Ready to unlock the suite for testing.
													</p>
												</div>
											</div>
										</HoverCardContent>
									</HoverCard>
								</div>
							</div>
						) : testSuite.status === "ready" ? (
							<div className="flex flex-row items-center gap-2">
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="draft" variant="outline">
									<p className="text-xs">Back to Draft</p>
								</SuiteStatusButton>
								<StartIterationDialog
									suiteId={testSuite.id}
									testSuiteSlug={testingSuiteSlug}
									trigger={
										<Button className="flex flex-row items-center gap-2">
											{NextIcon && <NextIcon className="h-4 w-4" />}
											<p className="text-xs">Start Testing</p>
										</Button>
									}
								/>
							</div>
						) : testSuite.status === "in_testing" && signOffContext ? (
							<div className="">
								<SignOffDialog
									suiteId={testSuite.id}
									hasActiveIteration={signOffContext.hasActiveIteration}
									latestCompleted={signOffContext.latestCompleted}
									trigger={
										<Button className="flex flex-row items-center gap-2">
											{NextIcon && <NextIcon className="h-4 w-4" />}
											<p className="text-xs">Sign Off</p>
										</Button>
									}
								/>
							</div>
						) : testSuite.status === "signed_off" ? (
							<div className="">
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="archived">
									{NextIcon && <NextIcon className="h-4 w-4" />}
									<p className="text-xs">Archive</p>
								</SuiteStatusButton>
							</div>
						) : testSuite.status === "archived" ? (
							<div className="">
								<SuiteStatusButton suiteId={testSuite.id} targetStatus="signed_off" variant="outline">
									<p className="text-xs">Unarchive</p>
								</SuiteStatusButton>
							</div>
						) : null
					}
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col">
				<PageTab overviewTab={overviewTabSlot} testCasesTab={testCasesTabSlot} testResultsTab={testResultsTabSlot} />
			</div>
		</div>
	)
}

async function OverviewContent({ suite }: { suite: { id: string; name: string; description: string } }) {
	const overview = await getSuiteOverview(suite.id);
	return <OverviewTab suite={suite} overview={overview} />;
}
