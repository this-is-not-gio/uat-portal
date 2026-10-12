import { notFound } from "next/navigation"
import { AlertCircle, Info } from "lucide-react"
import { Callout, Code, DocShell, type TocItem } from "@/components/manual/doc-parts"

const H2 = "border-b pb-2 text-xl font-semibold tracking-tight"

function SignOffDoc() {
	return (
		<>
			<section id="overview" className="scroll-mt-8 space-y-3">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Testing Manual
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">Sign-off</h1>
				<p className="text-muted-foreground">
					Sign-off is the final step of a UAT cycle. Once testing is finished, the suite is
					issued as a report and the client either acknowledges or rejects it.
				</p>
			</section>

			<section id="lifecycle" className="scroll-mt-8 space-y-3">
				<h2 className={H2}>Suite lifecycle</h2>
				<p>A suite moves through these stages in order:</p>
				<ol className="list-decimal space-y-1 pl-6">
					<li><Code>Draft</Code> – cases are being written or imported.</li>
					<li><Code>Ready</Code> – the suite is complete and waiting to start.</li>
					<li><Code>In Testing</Code> – testers are executing cases.</li>
					<li><Code>For Sign-off</Code> – testing is closed and the report is drafted.</li>
					<li><Code>Signed off</Code> – the report was issued and acknowledged.</li>
					<li><Code>Archived</Code> – the suite is read-only.</li>
				</ol>
				<Callout icon={Info} title="Going back">
					While a suite is For Sign-off you can still return it to testing if more results
					are needed.
				</Callout>
			</section>

			<section id="the-report" className="scroll-mt-8 space-y-3">
				<h2 className={H2}>The report</h2>
				<p>
					The report summarises results per section, lists failed steps with their remarks
					and evidence, and includes the scope and limitations of the testing.
				</p>
				<ul className="list-disc space-y-1 pl-6">
					<li>Results are frozen at the moment the report is created.</li>
					<li>Attachments appear as thumbnails on screen and as a file list in print.</li>
					<li>Custom sections can be added to carry over content from the Overview.</li>
				</ul>
			</section>

			<section id="issuing" className="scroll-mt-8 space-y-3">
				<h2 className={H2}>Issuing and responding</h2>
				<p>
					An author issues the report from the Sign-off tab. The client then reviews it and
					chooses one of two outcomes.
				</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border p-4">
						<p className="font-medium">Acknowledge</p>
						<p className="text-muted-foreground">
							The suite is marked Signed off and the report is final.
						</p>
					</div>
					<div className="rounded-lg border p-4">
						<p className="font-medium">Reject</p>
						<p className="text-muted-foreground">
							The suite returns to testing so the issues can be addressed.
						</p>
					</div>
				</div>
				<Callout icon={AlertCircle} title="Issuing is permanent">
					Once a report is issued it cannot be edited. Return the suite to testing first if
					something needs to change.
				</Callout>
			</section>
		</>
	)
}

function IntroductionDoc() {
	return (
		<>
			<section id="introduction" className="scroll-mt-8 space-y-3">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Testing Manual
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">Introduction</h1>
				<p className="text-muted-foreground">
					This manual explains how to take part in a UAT cycle: how a suite is organised, how to
					execute test cases, and how to record what you find. It is written for testers; authors
					and admins will find extra notes in each section.
				</p>
			</section>

			<section id="faq" className="scroll-mt-8 space-y-3">
				<h2 className={H2}>FAQ</h2>
				<div className="space-y-4">
					<div>
						<p className="font-medium">Can I change a result after saving it?</p>
						<p className="text-muted-foreground">
							Yes, until the suite moves to sign-off. After that, results are frozen.
						</p>
					</div>
					<div>
						<p className="font-medium">What if I cannot run a step?</p>
						<p className="text-muted-foreground">
							Leave a remark explaining the blocker and tell the suite owner.
						</p>
					</div>
				</div>
			</section>
		</>
	)
}

function GettingStartedDoc() {
	return (
		<>
			<section id="getting-started" className="scroll-mt-8 space-y-3">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Testing Manual
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">Getting Started</h1>
				<p>
					Open a testing suite from the dashboard. A suite is split into sections, and each
					section contains test cases. Your assigned test cases appear under the{" "}
					<strong>Test Cases</strong> tab.
				</p>
				<ol className="list-decimal space-y-1 pl-6">
					<li>Sign in with the account provided for the suite.</li>
					<li>Pick the suite you were invited to from the dashboard.</li>
					<li>Read the Overview tab for scope, test accounts and guidelines.</li>
					<li>Open the Test Cases tab and start with the highest priority items.</li>
				</ol>
				<Callout icon={Info} title="Tip">
					The Overview tab lists the test accounts and endpoints you are expected to use. Testing
					with any other account may invalidate your results.
				</Callout>
			</section>

			<section id="running-a-test-case" className="scroll-mt-8 space-y-3">
				<h2 className={H2}>Running a test case</h2>
				<p>
					Selecting a test case opens its detail sheet. Check the <Code>Preconditions</Code> first,
					then follow each step in <Code>Steps to execute</Code> in order.
				</p>
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-left text-sm">
						<thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
							<tr>
								<th className="px-4 py-2 font-medium">Field</th>
								<th className="px-4 py-2 font-medium">What it means</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{[
								["Preconditions", "State the system must be in before you start."],
								["Steps to execute", "Actions to perform, in order."],
								["Expected results", "What should happen after each step."],
								["Priority", "How important the case is to the sign-off."],
							].map(([field, meaning]) => (
								<tr key={field}>
									<td className="px-4 py-2 font-mono text-xs">{field}</td>
									<td className="px-4 py-2 text-muted-foreground">{meaning}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section id="recording-results" className="scroll-mt-8 space-y-3">
				<h2 className={H2}>Recording results</h2>
				<p>
					Mark every step as <Code>Passed</Code> or <Code>Failed</Code>. When a step fails, add a
					remark describing what you saw and attach evidence such as a screenshot.
				</p>
				<pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-6">
{`Step 3 — Failed
Expected: Confirmation toast appears
Actual:   Page reloads with no message
Evidence: checkout-error.png`}
				</pre>
				<Callout icon={AlertCircle} title="Before you submit">
					Results are included in the sign-off report once the suite is issued. Make sure remarks
					are clear enough for someone who did not run the test.
				</Callout>
			</section>
		</>
	)
}

const sections: Record<string, { toc: TocItem[]; Doc: () => React.JSX.Element }> = {
	introduction: {
		toc: [
			{ id: "introduction", label: "Introduction" },
			{ id: "faq", label: "FAQ" },
		],
		Doc: IntroductionDoc,
	},
	"getting-started": {
		toc: [
			{ id: "getting-started", label: "Getting started" },
			{ id: "running-a-test-case", label: "Running a test case" },
			{ id: "recording-results", label: "Recording results" },
		],
		Doc: GettingStartedDoc,
	},
	"sign-off": {
		toc: [
			{ id: "overview", label: "Overview" },
			{ id: "lifecycle", label: "Suite lifecycle" },
			{ id: "the-report", label: "The report" },
			{ id: "issuing", label: "Issuing and responding" },
		],
		Doc: SignOffDoc,
	},
}

export function generateStaticParams() {
	return Object.keys(sections).map((section) => ({ section }))
}

export default async function ManualSectionPage({
	params,
}: {
	params: Promise<{ section: string }>
}) {
	const { section } = await params
	const entry = sections[section]
	if (!entry) notFound()

	return (
		<DocShell toc={entry.toc}>
			<entry.Doc />
		</DocShell>
	)
}
