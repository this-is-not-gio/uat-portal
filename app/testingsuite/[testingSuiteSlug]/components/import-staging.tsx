"use client";

import { createContext, useContext, useState } from "react";
import type { importCase, importIssue } from "@/lib/import/parse-test-cases";

// A parsed import file waiting to be reviewed and saved. Only files without
// errors get staged, so `issues` holds warnings only.
export type stagedImport = {
	fileName: string;
	cases: importCase[];
	issues: importIssue[];
};

type importStaging = {
	staged: stagedImport | null;
	stage: (staged: stagedImport) => void;
	discard: () => void;
};

const ImportStagingContext = createContext<importStaging | null>(null);

// Lives in the suite layout so the staged file survives moving between tabs
// and sections (those navigations remount the page, not the layout).
export function ImportStagingProvider({ children }: { children: React.ReactNode }) {
	const [staged, setStaged] = useState<stagedImport | null>(null);

	return (
		<ImportStagingContext.Provider value={{ staged, stage: setStaged, discard: () => setStaged(null) }}>
			{children}
		</ImportStagingContext.Provider>
	);
}

export function useImportStaging() {
	const context = useContext(ImportStagingContext);
	if (!context) throw new Error("useImportStaging must be used inside ImportStagingProvider.");
	return context;
}
