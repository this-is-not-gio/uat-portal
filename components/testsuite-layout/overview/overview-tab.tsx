
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Calendar, ClipboardCheck, ClipboardList, Folder, Link, ListChecks, Notebook, Pencil, RotateCwFadingClock, Signpost, TestTubeDiagonal, TriangleAlert, Users } from "lucide-react";
import { formatTimestamp } from "@/lib/utils";
import type { suiteOverview, statusCounts } from "@/lib/supabase/overview";
import type { suiteEndpoint, suiteOverviewSection, suiteTestAccount } from "@/lib/supabase/test-accounts";
import { SuiteOverviewContent } from "./suite-overview-content";
import { EditOverviewButton, OverviewEditProvider } from "./overview-edit-state";
import { type testingsuiteLifeCycle } from "@/components/testsuite-layout/suite-status-badge";
import { ScopeOfTesting } from "@/components/testsuite-layout/overview/scope-of-testing";
import type { suiteScope } from "@/lib/supabase/test-suite";
import NextLink from "next/link";
import type { ExitCriteria } from "@/lib/supabase/sign-off-report";
import { SuiteEndpointsList } from "./suite-endpoints";
import { ExitCriteriaCard } from "../../exit-criteria-card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
// import { Seperator } from "@/components/ui/seperator";

// Server-rendered (the Description card is a client island). Name, description, test case count, timeline, roles,
// iterations and sign-offs are real; the guideline/account/endpoint sections
// are still static copy until the suite has fields for them.
export default function OverviewTab({ suite, scope, overview, testAccounts, overviewSections, endpoints, canEdit, exitCriteria, canEditCriteria }: { suite: { id: string; slug: string; name: string; description: string; status: testingsuiteLifeCycle }; scope: suiteScope; overview: suiteOverview; testAccounts: suiteTestAccount[]; overviewSections: suiteOverviewSection[]; endpoints: suiteEndpoint[]; canEdit: boolean; exitCriteria: ExitCriteria; canEditCriteria: boolean }) {
	const firstIteration = overview.iterations[overview.iterations.length - 1];
	const latestIteration = overview.iterations[0];
	const currentSignOff = overview.signOffs.find((s) => !s.revokedAt);
	const previousSignOffs = overview.signOffs.filter((s) => s.revokedAt);

	return (

		<OverviewEditProvider alwaysEdit={canEdit && suite.status === "draft"}>
			{/* No ScrollArea here: the suite layout's ScrollArea wraps every tab, so this just flows. */}
			<div className="flex flex-col py-5 px-4 md:px-6 w-full max-w-7xl mx-auto gap-5 min-h-0">
				<div className="w-full flex flex-col gap-4 lg:flex-row lg:justify-between">
					{/* The suite layout header already shows the name; only repeat it on wide screens. */}
					<div className="hidden lg:flex flex-row gap-2 items-center">
						<div className="size-10 bg-accent flex flex-row gap-2 items-center rounded-md justify-center p-2">
							<Folder />
						</div>
						<div className="">
							<p className="font-semibold"> {suite.name} </p>
							<p className="text-xs text-muted-foreground">Testing Suite</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-4 items-end">
						<div className="flex flex-col gap-1 lg:items-end">
							<p className="text-xs text-muted-foreground">Exit Criteria</p>
							<div className="flex flex-wrap gap-2">
								<div className="flex flex-row items-center gap-1 rounded-md py-1.5 px-2 bg-gray-600/5 w-fit text-gray-800">
									<div className="flex flex-row items-center gap-1">
										<p className="font-mono text-xs">{exitCriteria.minPassRate}%</p>
										<p className="text-xs font-semibold">Min. Pass Rate</p>
									</div>
								</div>
								<div className="flex flex-row items-center gap-1 rounded-md py-1.5 px-2 bg-gray-600/5 w-fit text-gray-800">
									<div className="flex flex-row items-center gap-1">
										<p className="font-mono text-xs">{exitCriteria.maxFailed}</p>
										<p className="text-xs font-semibold">Max Failed Cases</p>
									</div>
								</div>
								<div className="flex flex-row items-center gap-1 rounded-md py-1.5 px-2 bg-gray-600/5 w-fit text-gray-800">
									<div className="flex flex-row items-center gap-1">
										<p className="font-mono text-xs">{exitCriteria.maxBlocked}</p>
										<p className="text-xs font-semibold">Max Blocked Cases</p>
									</div>
								</div>
							</div>

						</div>
						<ScopeOfTesting scope={scope} align="start" />
						{canEdit && <EditOverviewButton />}
					</div>
				</div>
				<Separator />
				<div className="flex flex-col lg:flex-row w-full gap-6">

					<div className="w-full min-w-0 lg:flex-1 flex flex-col gap-4 pb-4">
						<SuiteOverviewContent testSuite={suite} suiteId={suite.id} description={suite.description} accounts={testAccounts} sections={overviewSections} canEdit={canEdit} />
					</div>
					<div className="w-full lg:w-72 lg:shrink-0">
						<div className="flex flex-col gap-4 pb-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<Notebook className="size-4 text-accent-foreground" />
								<p className="font-semibold">Testing Details</p>
							</div>
							<div className="flex flex-col gap-3">
								<div className="flex flex-col gap-1">
									<p className="font-mono bg-accent w-fit py-1 px-2 rounded-md text-xs">IC Licensing Project</p>
									<p className="text-xs">Project Name</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="font-semibold text-sm">Insurance Commissioner</p>
									<p className="text-xs">Project Owner</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="font-semibold text-sm">{overview.testCaseCount} Test Case{overview.testCaseCount === 1 ? "" : "s"}</p>
									<p className="text-xs">Number of Test Cases</p>
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-4 py-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<ListChecks className="size-4 text-accent-foreground" />
								<p className="font-semibold">Test Iterations</p>
							</div>
							{overview.iterations.length === 0 ? (
								<p className="text-xs text-muted-foreground">No iterations yet.</p>
							) : (
								<div className="flex flex-col gap-3">
									{overview.iterations.map((iteration) => (
										<div key={iteration.id} className="flex flex-col gap-1">
											<div className="flex flex-row items-center gap-2">
												<p className="font-semibold">{iteration.name}</p>
												{iteration.status === "in_progress" && <Badge variant="secondary" className="text-xs bg-blue-600/20">In Progress</Badge>}
												{iteration.status === "not_started" && <Badge variant="secondary" className="text-xs">Not Started</Badge>}
												{iteration.status === "stopped" && <Badge variant="secondary" className="text-xs bg-red-600/15 text-red-800">Stopped</Badge>}
											</div>
											<CountsLine counts={iteration.counts} />
											<p className="text-xs text-muted-foreground font-mono">
												{iteration.completedAt ? `Completed ${formatTimestamp(iteration.completedAt)}` : `Started ${formatTimestamp(iteration.startedAt)}`}
											</p>
										</div>
									))}
								</div>
							)}
						</div>
						<div className="flex flex-col gap-4 py-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<Users className="size-4 text-accent-foreground" />
								<p className="font-semibold">Roles to be Tested</p>
							</div>
							<div className="flex flex-wrap gap-1">
								{overview.roles.length > 0
									? overview.roles.map((role) => <Badge key={role}>{role}</Badge>)
									: <p className="text-xs text-muted-foreground">No role assignees on the test cases yet.</p>}
							</div>
						</div>
						<SuiteEndpointsList suiteId={suite.id} endpoints={endpoints} canEdit={canEdit} />
					</div>
				</div>
			</div>
		</OverviewEditProvider>
	)
}

function CountsLine({ counts }: { counts: statusCounts }) {
	return (
		<p className="text-xs font-mono">
			<span className="text-green-800">{counts.passed} passed</span>
			{" · "}<span className="text-red-800">{counts.failed} failed</span>
			{counts.blocked > 0 && <>{" · "}{counts.blocked} blocked</>}
			{" · "}<span className="text-muted-foreground">{counts.untested + counts.inProgress} not tested</span>
		</p>
	);
}

function SignOffEntry({ signOff, suiteSlug }: { signOff: suiteOverview["signOffs"][number]; suiteSlug: string }) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex flex-row items-center gap-2">
				<p className="font-semibold">Issued by {signOff.signedOffBy ?? "Unknown"}</p>
				{signOff.revokedAt ? <Badge variant="outline" className="text-xs">Revoked</Badge>
					: !signOff.acknowledgedAt && <Badge variant="outline" className="text-xs">Awaiting acknowledgement</Badge>}
			</div>
			<p className="text-xs text-muted-foreground font-mono">
				{formatTimestamp(signOff.signedOffAt)} · based on {signOff.iterationName}
				{signOff.acknowledgedAt && ` · acknowledged ${formatTimestamp(signOff.acknowledgedAt)}${signOff.acknowledgedBy ? ` by ${signOff.acknowledgedBy}` : ""}`}
				{signOff.revokedAt && ` · reopened ${formatTimestamp(signOff.revokedAt)}${signOff.revokedBy ? ` by ${signOff.revokedBy}` : ""}`}
			</p>
			<CountsLine counts={signOff.exceptions} />
			{signOff.note && <p className="text-sm">{signOff.note}</p>}
			{signOff.hasReport && (
				<NextLink href={`/testingsuite/${suiteSlug}/sign-off/${signOff.id}/report`} className="text-xs underline underline-offset-4 w-fit">
					View sign-off report
				</NextLink>
			)}
		</div>
	);
}
