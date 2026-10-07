import TestResultsShell from "@/components/testsuite-layout/test-results/test-results-shell";

// Stays mounted while moving between rounds and sections, so the sidebar tree isn't reset.
export default function TestResultsLayout({ children }: LayoutProps<"/testsuite/[testSuiteSlug]/test-results">) {
	return <TestResultsShell>{children}</TestResultsShell>;
}
