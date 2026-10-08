"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type SelectionState = Record<string, number>;

const SelectionContext = createContext<{
	counts: SelectionState;
	setCount: (iterationId: string, count: number) => void;
} | null>(null);

export function IterationSelectionProvider({ children }: { children: React.ReactNode }) {
	const [counts, setCounts] = useState<SelectionState>({});
	// Stable identity across renders — callers (e.g. IterationTestCaseList's
	// useEffect) put this in a dependency array, so a fresh function every
	// render would re-trigger those effects forever. Also skips the state
	// update entirely when the value hasn't actually changed.
	const setCount = useCallback((key: string, count: number) => {
		setCounts((current) => (current[key] === count ? current : { ...current, [key]: count }));
	}, []);
	const value = useMemo(() => ({ counts, setCount }), [counts, setCount]);

	return (
		<SelectionContext.Provider value={value}>
			{children}
		</SelectionContext.Provider>
	);
}

// ResultLeaf (the reader of this context) is shared by both the Test Cases
// tab's sidebar (wrapped in the Provider) and the Test Results tab's own
// sidebar (not wrapped in it) — falling back to a no-op default instead of
// throwing keeps the Test Results tab working, it just never shows counts.
const noopSelection = { counts: {} as SelectionState, setCount: () => {} };

export function useIterationSelection() {
	return useContext(SelectionContext) ?? noopSelection;
}
