"use client";

import { useIterationSelection } from "@/components/testsuite-layout/shared/iteration-selection-context";

// Header count for a round's section. IterationTestCaseList publishes the live
// tick count to the selection context; until it does, show the server's count.
export default function IterationSectionCaseCount({
	selectionKey,
	initialIncluded,
	total,
}: {
	selectionKey: string;
	initialIncluded: number;
	total: number;
}) {
	const { counts } = useIterationSelection();
	const included = counts[selectionKey] ?? initialIncluded;

	return (
		<p className="text-xs text-muted-foreground whitespace-nowrap">
			<span className="font-medium font-mono text-foreground">{included}</span> out of <span className="font-medium font-mono text-foreground">{total}</span> test cases included
		</p>
	);
}
