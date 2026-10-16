import { ScrollArea } from "@/components/ui/scroll-area";
import { DailyTargetTable } from "./daily-target-table";
import { BadgeCheck, Bug, Building2, CalendarCheck, FileSignature, ListChecks, Headset, Timer, Users, Video, Check, CalendarDays, ClipboardList, GraduationCap, Laptop, MessageSquareWarning, PlayCircle, Target, BugOff } from "lucide-react";

function Mono({ children }: { children: string }) {
	return children
		.split(/(\d[\d:–.]*)/)
		.map((part, i) => (i % 2 === 1 ? <span key={i} className="font-mono">{part}</span> : part));
}

const STEPS = [
	{
		Icon: GraduationCap,
		title: "Learn it",
		body: "Join the onsite session where we walk through each part of the system.",
	},
	{
		Icon: PlayCircle,
		title: "Try it",
		body: "Follow the step-by-step test cases on the UAT website and mark whether each one worked.",
	},
	{
		Icon: MessageSquareWarning,
		title: "Tell us",
		body: "Report anything broken, confusing, or different from how the Licensing Division really works.",
	},
];


const PHASES = [
	{
		week: "WEEK 1 · OCT 19–23",
		title: "Company Licensing",
		description: "The first batch of test cases focus on the company licensing workflow, from registration to approval.",
		items: [
			"Company Registration and Approval",
			"Company Details on Finalization",
			"SEC Endorsement",
			"Certificate of Authority",
		],
	},
	{
		week: "WEEK 2 · OCT 26–30",
		description: "The second batch of test cases focus on the renewal and agent management workflows.",
		title: "Renewal and Agent",
		items: ["Certificate of Authority", "Company Renewal", "Agents"],
	},
	{
		week: "WEEK 3 · NOV 3–6",
		title: "Agency, Admin and Others",
		description: "The third batch of test cases focus on the agency and admin workflows.",
		items: ["Agency", "Admin Workflow"],
	},
];

const DAYS = [
	{
		day: "Monday",
		mode: "Onsite",
		focus: "Knowledge Transfer, Live demos, Account handover and Login check",
		output: "Attendance sheet; verified accounts",
	},
	{
		day: "Tuesday",
		mode: "Remote",
		focus: "Main happy-path scenarios",
		output: "Executed scripts; logged defects",
	},
	{
		day: "Wednesday",
		mode: "Remote",
		focus: "Main scenarios and edge cases",
		output: "Executed scripts; logged defects",
	},
	{
		day: "Thursday",
		mode: "Remote",
		focus: "Exception and negative scenarios; defect cutoff 12:00 NN",
		output: "Fixes deployed after 5:00 PM",
	},
	{
		day: "Friday",
		mode: "Remote",
		focus: "Retest by 2:00 PM; virtual acceptance review at 3:00 PM",
		output: "Batch acknowledgement",
	},
];


const EXIT_CRITERIA = [
	{ Icon: ListChecks, value: "100%", label: "of scenarios executed" },
	{ Icon: BadgeCheck, value: "95%", label: "or more passed" },
	{ Icon: Bug, value: "0", label: "open Severity 1 and 2 defects" },
	{ Icon: FileSignature, value: "Acknowledged", label: "Reports and results" },
];

const SUPPORT = [
	{ Icon: Headset, value: "8 AM – 5 PM", label: "Support desk open on testing days" },
	{ Icon: Timer, value: "1 hour", label: "Target response to questions and blockers" },
	{ Icon: Video, value: "10:00 AM", label: "Optional 30-minute virtual office" },
	{ Icon: Users, value: "4:30 PM", label: "15-minute DCI–IC check-in on progress" },
];

const STATS = [
	{ Icon: CalendarDays, value: 14, label: "working days in the UAT window" },
	{ Icon: Building2, value: 3, label: "onsite KT days" },
	{ Icon: Laptop, value: 11, label: "asynchronous testing days" },
];

const SCHEDULE = [
	{
		label: "MONDAYS · ONSITE AT THE IC",
		title: "Knowledge Transfer",
		body: "Module walkthrough, live demo and account handover. Every tester logs in and runs one scenario before leaving the room.",
	},
	{
		label: "TUESDAY TO FRIDAY · REMOTE",
		title: "Asynchronous testing",
		body: "Testers run assigned scenarios on the UAT Website at their own pace, against daily targets, with DCI support on chat.",
	},
];

export default function MasterPlanPage() {
	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="flex flex-col gap-30 py-10 sm:gap-60 sm:py-16 sm:pb-50">
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-muted/60 via-background to-muted/30 px-6 py-10 sm:px-10 sm:py-14">
						<div className="flex max-w-2xl flex-col gap-3">
							<BugOff strokeWidth={1.5} className="size-70 absolute right-6 top-6" aria-hidden />
							<p className="text-xs text-muted-foreground">
								INSURANCE COMMISSION LICENSING SYSTEM · MILESTONE 4 · PHASE 6: TESTING & HARDENING
							</p>
							<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
								User Acceptance Testing Master Plan
							</h1>
							<p className="text-sm font-semibold">
								Onsite Knowledge Transfer, asynchronous testing
							</p>
						</div>
					</section>
				</div>
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<div className="pb-8 mb-10 border-b flex flex-col gap-4">
						<p className="text-sm text-black uppercase">
							What is User Acceptance Testing
						</p>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
							A final check before go-live
						</h1>
					</div>
					<div className="">
						<p>User Acceptance Testing is a practice run before go-live. The people who will use ICLS every day try it with real-life cases on a practice copy of the system, so nothing they do affects real records.</p>
					</div>
					<ol className="mt-10 grid gap-6 md:grid-cols-3">
						{STEPS.map((step, i) => (
							<li key={step.title} className="flex flex-col gap-5 rounded-xl border bg-card p-6">
								<div className="flex flex-row items-center gap-4 justify-between">
									<div className="flex items-center gap-3">
										<step.Icon className="size-5" aria-hidden />
										<h2 className="text-lg font-semibold">{step.title}</h2>
									</div>
									<span className="flex size-8 items-center justify-center rounded-full border bg-muted text-sm font-semibold font-mono">
										{i + 1}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">{step.body}</p>
							</li>
						))}
					</ol>
					<div className="rounded-xl border border-primary/20 bg-accent-foreground p-6 text-primary-foreground mt-8">
						<p className="font-semibold tracking-tight text-xl">
							That Milestone 4 · Phase 6: Testing &amp; Hardening is all about
						</p>
					</div>

				</div>
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<div className="pb-8 mb-10 border-b flex flex-col gap-4">
						<p className="text-sm text-black uppercase">
							How User Acceptance Testing run
						</p>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
							Learn together onsite, then test on your own time
						</h1>
					</div>
					<ul className="mt-8 grid gap-6 sm:grid-cols-2">
						{SCHEDULE.map((item) => (
							<li key={item.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
								<p className="text-xs font-medium tracking-wide text-muted-foreground"><Mono>{item.label}</Mono></p>
								<h2 className="text-xl font-semibold">{item.title}</h2>
								<p className="text-sm text-muted-foreground">{item.body}</p>
							</li>
						))}
					</ul>
					<dl className="mt-8 grid grid-cols-1 divide-y rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
						{STATS.map((stat) => (
							<div key={stat.label} className="flex flex-col gap-1 px-6 py-5">
								<div className="flex flex-row items-center gap-3">
									<dd className="text-4xl font-semibold font-mono tracking-tight">{stat.value}</dd>
									<stat.Icon className="size-7" aria-hidden />
								</div>
								<dt className="order-2 text-sm text-muted-foreground font-semibold">{stat.label}</dt>
							</div>
						))}
					</dl>
				</div>
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<div className="pb-8 mb-10 border-b flex flex-col gap-4">
						<p className="text-sm text-black uppercase">
							User Acceptance Testing Scope
						</p>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
							Three Weekly Batches, Three UAT Phases
						</h1>
					</div>
					<ol className="grid gap-6 md:grid-cols-3">
						{PHASES.map((phase, i) => (
							<li key={phase.title} className="flex flex-col gap-5 rounded-xl border bg-card p-6">
								<div className="flex flex-row items-center justify-between gap-4">
									<p className="text-xs font-medium tracking-wide text-muted-foreground"><Mono>{phase.week}</Mono></p>
									<span className="flex size-8 items-center justify-center rounded-full border bg-muted text-sm font-semibold font-mono">
										{i + 1}
									</span>
								</div>
								<div className="">
									<h2 className="text-xl font-semibold">{phase.title}</h2>
									<p className="text-xs text-muted-foreground">{phase.description}</p>
								</div>
								<ul className="flex flex-col gap-2 border-t pt-4 text-sm">
									{phase.items.map((item) => (
										<li key={item} className="flex items-start gap-2">
											<Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
											{item}
										</li>
									))}
								</ul>
							</li>
						))}
					</ol>
					<div className="pt-8">
						<p className="text-sm text-black">
							Test cases run across three weeks, split into weekly batches so testers can focus on one area of ICLS at a time. Week 1 covers Company Licensing, Week 2 covers Renewal and Agent, and Week 3 wraps up Agency, Admin and other workflows.
						</p>
					</div>
				</div>
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<div className="pb-8 mb-10 border-b flex flex-col gap-4">
						<p className="text-sm text-black uppercase">
							User Acceptance Testing Phases
						</p>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
							Every week follows the same five-day cycle
						</h1>
					</div>
					<ol className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-5">
						{DAYS.map((d) => (
							<li key={d.day} className="flex flex-col gap-5 rounded-xl border bg-card p-6">
								<span
									className={`w-fit flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${d.mode === "Onsite"
										? "border-primary bg-primary text-primary-foreground"
										: "bg-muted"
										}`}
								>
									{d.mode === "Onsite" ? <Building2 className="size-3" aria-hidden /> : <Laptop className="size-3" aria-hidden />}
									{d.mode}
								</span>
								<div className="flex flex-row items-center justify-between gap-2">
									<h2 className="text-2xl font-semibold font-mono tracking-tight">{d.day}</h2>
								</div>
								<p className="text-sm"><Mono>{d.focus}</Mono></p>
								<div className="mt-auto flex flex-col gap-1 border-t pt-4">
									<p className="text-xs font-medium tracking-wide text-muted-foreground">OUTPUT</p>
									<p className="text-sm text-muted-foreground"><Mono>{d.output}</Mono></p>
								</div>
							</li>
						))}
					</ol>
					<div className="pt-8">
						<p className="text-sm text-black">
							Defects logged on Tuesday and Wednesday are fixed and deployed the same evening, so retesting happens throughout the week, not just on Friday.
						</p>
					</div>
				</div>
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<div className="pb-8 mb-10 border-b flex flex-col gap-4">
						<p className="text-sm text-black uppercase">
							Support Desk
						</p>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
							Testers get help from a remote support desk
						</h1>
					</div>
					<dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
						{SUPPORT.map((s) => (
							<div key={s.label} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
								<s.Icon className="size-5 text-muted-foreground" aria-hidden />
								<dd className="text-2xl font-semibold font-mono tracking-tight">{s.value}</dd>
								<dt className="order-last text-sm text-muted-foreground">{s.label}</dt>
							</div>
						))}
					</dl>
					<div className="pt-8">
						<p className="text-sm text-black">
							Questions and blockers get a response within an hour while the desk is open, with an optional virtual office each morning and a short DCI–IC check-in at the end of the day.
						</p>
					</div>

				</div>
				<div className="mx-4 sm:mx-8 lg:mx-16 xl:mx-40 2xl:mx-70">
					<div className="pb-8 mb-10 border-b flex flex-col gap-4">
						<p className="text-sm text-black uppercase">
							Targets
						</p>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
							Daily target keep aynchronous testing on pace
						</h1>
					</div>
					<div className="flex flex-col gap-6">
						<p className="text-sm text-black">
							Targets are cumulative scenarios executed. Thursday adds the <span className="font-mono font-normal text-black">12:00 NN</span> defect cutoff. <span className="font-mono font-normal text-black">OCT 30</span> also holds the <span className="font-mono font-normal text-black">Week 3</span> readiness check.
						</p>
						<div className="overflow-x-auto"><div className="min-w-160"><DailyTargetTable /></div></div>
					</div>
					<div className="mb-8 mt-16 flex flex-col gap-1">
						<p className="text-lg font-semibold">What must be true before and after each batch?</p>
						<p className="text-sm text-black">Expected outcomes and exit criteria:</p>
					</div>
					<dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
						{EXIT_CRITERIA.map((c) => (
							<div key={c.label} className="flex flex-col gap-1 rounded-xl border bg-card p-6">
								<div className="flex flex-row justify-between">
									<dd className="text-xl font-semibold font-mono tracking-tight">{c.value}</dd>
									<c.Icon className="size-5 text-muted-foreground" aria-hidden />
								</div>
								<dt className="order-last text-xs text-muted-foreground">{c.label}</dt>
							</div>
						))}
					</dl>

				</div>
			</div>
		</ScrollArea>
	);
}
