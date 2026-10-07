import { notFound } from "next/navigation";
import TestCasesShell from "@/components/testsuite-layout/test-cases/test-cases-shell";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getSectionNames } from "@/lib/supabase/test-sections";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";

// Stays mounted while moving between sections, so the sidebar tree and a staged import aren't reset.
export default async function TestCasesLayout({ children, params }: LayoutProps<"/testsuite/[testSuiteSlug]/test-cases">) {
	const { testSuiteSlug } = await params;
	const [testSuite, currentUser] = await Promise.all([getTestSuiteBySlug(testSuiteSlug), getCurrentUser()]);
	if (!testSuite) notFound();

	const isTester = currentUser?.role === "Internal" || currentUser?.role === "External";
	// Only staff can import, so only they need the existing names to flag new sections.
	const existingSectionNames = isTester ? [] : await getSectionNames(testSuite.id);

	return (
		<TestCasesShell existingSectionNames={existingSectionNames} importSuite={isTester ? undefined : { id: testSuite.id, status: testSuite.status }}>
			{children}
		</TestCasesShell>
	);
}
