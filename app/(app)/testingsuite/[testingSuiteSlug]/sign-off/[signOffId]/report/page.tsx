import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSignOffReport } from "@/lib/supabase/sign-off-report";
import { SignOffReportView } from "@/components/sign-off-report/sign-off-report-view";
import { PrintButton } from "./print-button";

// The frozen sign-off report (suite_sign_offs.report): what the vendor issued and the client
// acknowledges. Read-only; every number comes from the report jsonb, never from live data.
// PDF = window.print(); @media print in globals.css hides the sidebar and header.

type Params = Promise<{ testingSuiteSlug: string; signOffId: string }>;

// Shared by generateMetadata and the page.
const loadReport = cache((suiteSlug: string, signOffId: string) => getSignOffReport({ suiteSlug, signOffId }));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { testingSuiteSlug, signOffId } = await params;
	const frozen = await loadReport(testingSuiteSlug, signOffId);
	// Also the default file name of the saved PDF.
	return { title: frozen ? `${frozen.report.header.suiteName} – Sign-off report` : "Sign-off report" };
}

export default async function SignOffReportPage({ params }: { params: Params }) {
	const { testingSuiteSlug, signOffId } = await params;
	const frozen = await loadReport(testingSuiteSlug, signOffId);
	if (!frozen) notFound();

	return (
		<div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
			<article className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-16 print:max-w-none print:px-0 print:pb-0">
				<div className="flex flex-row items-center justify-between gap-4 print:hidden">
					<Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/testingsuite/${testingSuiteSlug}`} />}>
						<ArrowLeftIcon />
						Back to suite
					</Button>
					<PrintButton />
				</div>
				<SignOffReportView frozen={frozen} />
			</article>
		</div>
	);
}
