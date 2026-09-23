"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, ClipboardCheck, ClipboardList, IdCard, Info, Link, Notebook, RotateCwFadingClock, Signpost, TestTubeDiagonal, TriangleAlert, Users } from "lucide-react";

export default function OverviewTab() {
	return (

		<ScrollArea className="h-full">
			<div className="flex flex-col items-center py-10 w-300 mx-auto">
				<div className="flex flex-row w-full border-b pb-4 justify-between items-center">
					<div className="flex flex-row items-center gap-4">
						<div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted text-muted-foreground">
							<ClipboardList data-icon="inline-start" size={24} />
						</div>
						<div className="flex flex-col">
							<p className="text-sm font-heading font-semibold">SEC Endorsement</p>
							<p className="text-xs text-accent-foreground">Test Suite</p>
						</div>
					</div>
					<div>

					</div>
				</div>
				<div className="flex flex-row w-full h-full justify-center gap-6">
					<div className="w-4xl flex flex-col gap-4 py-4">
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<Info className="text-accent-foreground size-4" />
								<p className="font-semibold">Description</p>
							</div>
							<div className="p-4">
								<p>This suite validates the full company registration lifecycle: application intake, document validation, SEC endorsement routing, and final certificate issuance. Test cases confirm correct behavior for required fields, role-based approval steps, and edge cases such as rejected or resubmitted applications, ensuring the workflow holds up under real UAT conditions before go-live.</p>
							</div>
						</div>
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<IdCard className="text-accent-foreground size-4" />
								<p className="font-semibold">Test Accounts</p>
							</div>
							<div className="p-4">
								<p>This suite validates the full company registration lifecycle: application intake, document validation, SEC endorsement routing, and final certificate issuance. Test cases confirm correct behavior for required fields, role-based approval steps, and edge cases such as rejected or resubmitted applications, ensuring the workflow holds up under real UAT conditions before go-live.</p>
							</div>
						</div>
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<TestTubeDiagonal className="text-accent-foreground size-4" />
								<p className="font-semibold">Tester needs to do</p>
							</div>
							<div className="p-4">
								<p>  Before starting, make sure you&apos;re logged in with the role assigned to
									you for this suite, since several steps depend on role-based access and
									approval permissions. Begin by submitting a new company registration
									application with valid test data, then work through each subsequent test
									case in order — document validation, SEC endorsement routing, and final
									certificate issuance — confirming that the actual result matches the
									expected result described in each test case. Pay close attention to
									required field validation, error messaging, and status transitions as the
									application moves between stages. Be sure to also exercise edge cases
									such as incomplete submissions, rejected applications, and resubmission
									flows, since these are common sources of regressions. For every test case
									you execute, record a clear Pass or Fail outcome, and for any failure,
									attach a screenshot, the exact steps you took, and any relevant error
									output so the issue can be reproduced and triaged quickly. If you&apos;re
									blocked or unsure whether a behavior is expected, flag it rather than
									guessing, and note it in the remarks field for follow-up.</p>
							</div>
						</div>
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<Signpost className="text-accent-foreground size-4" />
								<p className="font-semibold">Testing Guidelines</p>
							</div>
							<div className="p-4">
								<ul className="list-disc pl-5 flex flex-col gap-2">
									<li>
										Do not update test account details such as passwords, usernames, or
										profile information — these accounts are shared across the team, and
										changing them will lock other testers out or invalidate test data
										that's already in progress.
									</li>
									<li>
										Raise anything confusing, unclear, or impractical, even if it isn't
										strictly a bug. If a flow feels awkward, a label is ambiguous, or a
										step takes more clicks than it should, flag it — UAT is the last
										checkpoint before this becomes muscle memory for real users.
									</li>
									<li>
										Focus on business alignment over technical correctness. The goal
										isn't just "does it work," but "does it work the way the business
										actually needs it to." Call out any mismatch between the system's
										behavior and the real-world process it's meant to support.
									</li>
									<li>
										Test within the scope of your assigned role and permissions only,
										and avoid attempting workarounds outside the intended flow unless
										you're specifically testing negative or edge cases.
									</li>
									<li>
										Report issues as you find them rather than batching them at the end
										— this makes it easier to reproduce and resolve them while the
										context is still fresh.
									</li>
									<li>
										Avoid modifying or deleting other testers' data (records, entries,
										or test cases) unless it's explicitly part of the test you're
										executing.
									</li>
								</ul>
							</div>
						</div>
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<TriangleAlert className="text-accent-foreground size-4" />
								<p className="font-semibold">Things <b>NOT</b> to do in testing </p>
							</div>
							<div className="p-4">
								<ul className="list-disc pl-5 flex flex-col gap-2">
									<li>
										Technical edge cases — scenarios like malformed input, boundary
										values, or unusual data combinations are the engineering team's
										responsibility to cover in unit and integration tests, not something
										testers need to hunt for here.
									</li>
									<li>
										Performance or stress testing — you don't need to check how the
										system behaves under heavy load, concurrent users, or large data
										volumes. That's handled separately through dedicated performance
										testing, not as part of this UAT pass.
									</li>
									<li>
										Backend validation — there's no need to inspect databases, API
										responses, or server logs to confirm data integrity. Your focus is
										on whether the application behaves correctly from the user's point
										of view, through the actual interface.
									</li>
								</ul>
							</div>
						</div>
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<ClipboardCheck className="text-accent-foreground size-4" />
								<p className="font-semibold">Success criteria for sign-off</p>
							</div>
							<div className="p-4">
								<ul className="list-disc pl-5 flex flex-col gap-2">
									<li>
										Core business flows work end-to-end — every primary process covered
										in this suite, from start to finish, completes successfully without
										requiring workarounds or manual intervention.
									</li>
									<li>
										No critical issues remain open — all high-priority defects found
										during testing have been resolved and verified, with no blockers
										that would prevent real users from completing their work.
									</li>
									<li>
										Processes reflect operational workflow — what's been tested matches
										how the business actually operates day to day, not just what the
										system was originally designed to do on paper.
									</li>
									<li>
										Business owners confirm readiness — the stakeholders responsible for
										this process have reviewed the results and formally agree that the
										system is fit to go live.
									</li>
								</ul>
							</div>
						</div>
						<div className="flex flex-col gap-1 border rounded-md">
							<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
								<RotateCwFadingClock className="text-accent-foreground size-4" />
								<p className="font-semibold">Timeline & Reporting</p>
							</div>
							<div className="p-4">
								<ul className="list-disc pl-5 flex flex-col gap-2">
									<li>
										Complete assigned test cases within the agreed timeline — stick to
										the schedule set for this suite so the overall UAT window isn't
										delayed waiting on outstanding cases.
									</li>
									<li>
										Update the UAT sheet daily — record your progress and results as you
										go, rather than at the end, so status is always accurate for anyone
										checking in on the suite.
									</li>
									<li>
										Raise blockers immediately — if something stops you from proceeding,
										flag it right away instead of waiting, so it can be resolved without
										stalling your remaining test cases.
									</li>
									<li>
										Document bugs in the defect tracker whenever you find one — log it
										as soon as it's found, with enough detail to reproduce, rather than
										relying on memory or a separate note.
									</li>
								</ul>
							</div>
						</div>

					</div>
					<div className="flex-1 h-full">
						<div className="flex flex-col gap-4 py-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<Notebook className="size-4 text-accent-foreground" />
								<p className="font-semibold">Testing Details</p>
							</div>
							<div className="flex flex-col gap-3">
								<div className="flex flex-col gap-1">
									<p className="font-mono bg-accent w-fit py-1 px-2 rounded-md">IC Licensing Project</p>
									<p className="text-xs">Project Name</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="font-semibold">Insurance Commissioner</p>
									<p className="text-xs">Project Owner</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="font-semibold">10 Test Cases</p>
									<p className="text-xs">Number of Test Cases</p>
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-4 py-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<Calendar className="size-4 text-accent-foreground" />
								<p className="font-semibold">Testing Timeline</p>
							</div>
							<div className="flex flex-col gap-3">
								<div className="flex flex-col gap-1">
									<p className="font-semibold">January 12, 2023 - 06:00 AM</p>
									<p className="text-xs">Starting Timeline</p>
								</div>
								<div className="flex flex-col gap-1">
									<p className="font-semibold">January 31, 2023 - 06:00 PM</p>
									<p className="text-xs">Ending Timeline</p>
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-4 py-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<Users className="size-4 text-accent-foreground" />
								<p className="font-semibold">Roles to be Tested</p>
							</div>
							<div className="flex flex-wrap gap-1">
								<Badge>Action-Officer</Badge>
								<Badge>Supervisor</Badge>
								<Badge>Division Manager</Badge>
								<Badge>Deputy Commissioner</Badge>
								<Badge>Insurance Commissioner</Badge>
							</div>
						</div>
						<div className="flex flex-col gap-4 py-6 border-b">
							<div className="flex flex-row gap-2 items-center">
								<Link className="size-4 text-accent-foreground" />
								<p className="font-semibold">Endpoints</p>
							</div>
							<div className="flex flex-wrap gap-1">
								<div className="flex flex-col gap-1">
									<div className="flex flex-row items-center gap-2">
										<Link className="size-3 text-accent-foreground" />
										<p className="font-semibold">Http: https://api.example.com</p>
									</div>
									<p className="text-xs">Testing Endpoint 1</p>
								</div>
								<div className="flex flex-col gap-1">
									<div className="flex flex-row items-center gap-2">
										<Link className="size-3 text-accent-foreground" />
										<p className="font-semibold">Http: https://api.example.com</p>
									</div>
									<p className="text-xs">Testing Endpoint 1</p>
								</div>
								<div className="flex flex-col gap-1">
									<div className="flex flex-row items-center gap-2">
										<Link className="size-3 text-accent-foreground" />
										<p className="font-semibold">Http: https://api.example.com</p>
									</div>
									<p className="text-xs">Testing Endpoint 1</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</ScrollArea>
	)
}
