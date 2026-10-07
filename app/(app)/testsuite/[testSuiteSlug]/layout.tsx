
import { ImportStagingProvider } from "@/components/testsuite-layout/test-cases/import-staging";
import { statusMapping } from "@/components/testsuite-layout/suite-status-badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSuiteSignOffs } from "@/lib/supabase/overview";
import { getSuiteReadinessIssues, getSuiteScope, getTestSuiteBySlug, readinessIssue, suiteScope } from "@/lib/supabase/test-suite";
import { cn } from "cn";
import { Circle, CircleCheck, MoreVertical } from "lucide-react";
import { notFound } from "next/navigation";
import SuiteStatusButton from "@/app/(app)/testingsuite/[testingSuiteSlug]/components/suite-status-button";
import SuiteTabs from "../../../../components/testsuite-layout/suite-tabs";


export default async function TestSuiteLayout({ children, params }: LayoutProps<"/testsuite/[testSuiteSlug]">) {
	const slug = await params
	const testSuite = await getTestSuiteBySlug(slug.testSuiteSlug);
	if (!testSuite) {
		notFound();
	}
	// cache()'d, so this reuses the (app) layout's lookup instead of refetching.
	const currentUser = await getCurrentUser();
	const [draftIssues, scope, allSignOffs] = await Promise.all([
		testSuite.status === "draft" ? getSuiteReadinessIssues(testSuite.id) : Promise.resolve([]),
		getSuiteScope(testSuite.id),
		can(currentUser, "view_all_results") && testSuite.status !== "draft" && testSuite.status !== "ready"
			? getSuiteSignOffs(testSuite.id) : Promise.resolve([]),
	]);
	const canMarkReady = draftIssues.length === 0;
	const isTester = currentUser?.role === "Internal" || currentUser?.role === "External";
	const reportSignOffs = allSignOffs.filter((s) => s.hasReport);
	const showSignOffTab = reportSignOffs.length > 0;


	const { Icon, label, className, IconColor, nextStatusIcon: NextIcon } = statusMapping[testSuite.status];

	return (
		// The app shell clips overflow (body is overflow-hidden), so the suite page is its own scroll container.
		// min-h-0 + flex-1 give the ScrollArea a bounded height; without it the viewport never overflows.

		<div className="flex min-h-0 flex-1 flex-col">
			{/* Header */}
			<div className="p-6 flex-row flex justify-between sm:gap-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full">
					<div className="flex flex-row gap-2 items-center shrink-0">
						<div className={cn("w-12 h-12 shrink-0 bg-primary rounded-md flex items-center justify-center border", statusMapping[testSuite.status].className)}>
							<Icon className={IconColor} />
						</div>
						<div className="flex flex-col gap-1">
							<div className="flex flex-row gap-1 items-center whitespace-nowrap">
								<p className="font-heading font-bold text-lg leading-none">{testSuite.name}</p>
							</div>
							<p className="text-xs text-muted-foreground font-medium">{label} Test Suite</p>
						</div>
					</div>
					<div className="flex flex-row items-center gap-5 w-full lg:w-auto">
						{
							testSuite.status === "draft" ?
								<div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-4">
									<div className="grid gap-3 grid-cols-2 lg:flex lg:flex-row lg:items-center lg:gap-4">
										{readinessChecklist(scope, draftIssues).map((item) => (
											<div key={item.title} className="flex flex-row items-center gap-2">
												{item.met
													? <CircleCheck className="size-5 text-green-800" />
													: <Circle className="size-5 text-muted-foreground" />}
												<div className="">
													<p className="font-semibold text-xs">{item.title}</p>
													<p className="text-xs text-muted-foreground">{item.description}</p>
												</div>
											</div>
										))}
									</div>
									{/* Hidden until every checklist item is met (the DB rejects the move otherwise). */}
									{canMarkReady && (
										<SuiteStatusButton suiteId={testSuite.id} targetStatus="ready">
											{NextIcon && <NextIcon className="h-4 w-4" />}
											<p className="text-xs">Mark as Ready</p>
										</SuiteStatusButton>
									)}
								</div> : null
						}
					</div>
				</div>
				<Button variant="outline" size="icon" >
					<MoreVertical />
				</Button>
			</div>
			{/* Tabs */}
			<SuiteTabs suiteSlug={testSuite.slug} showTestResults={!isTester && testSuite.status !== "draft" && testSuite.status !== "ready"} showSignOff={showSignOffTab} />
			<ScrollArea className="min-h-0 flex-1">
				{/* Content. The staged import lives here so it survives switching tabs. */}
				<ImportStagingProvider>{children}</ImportStagingProvider>
			</ScrollArea>
		</div>
	)
}

function readinessChecklist(scope: suiteScope, issues: readinessIssue[]) {
	const has = (issue: readinessIssue["issue"]) => issues.some((i) => i.issue === issue);
	return [
		{
			title: "Test cases added",
			description: scope.testCaseCount > 0
				? `${scope.testCaseCount} test case${scope.testCaseCount === 1 ? "" : "s"} in this suite`
				: "Add or import test cases",
			met: scope.testCaseCount > 0,
		},
		{
			title: "One complete test case",
			description: "Steps, expected results and a role assignee",
			met: !has("no_complete_test_cases"),
		},
		{
			title: "Test account added",
			description: "At least one login on the Overview",
			met: !has("no_test_accounts"),
		},
		{
			title: "Endpoint added",
			description: "At least one URL on the Overview",
			met: !has("no_endpoints"),
		},
	];
}
