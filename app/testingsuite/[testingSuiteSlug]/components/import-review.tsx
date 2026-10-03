"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable } from "@/components/table/data-table";
import { getImportReviewColumns, type importReviewRow } from "@/components/table/import-review-columns";
import { AlertTriangle, FilePlus, FileSpreadsheet, Undo2, X } from "lucide-react";
import { useImportStaging, type stagedImport } from "./import-staging";
import ImportUATTestCases from "./import-uat-test-cases";
import { importTestCases } from "@/lib/supabase/authoring-actions";
import type { suiteStatus } from "@/lib/supabase/Init";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const columns = getImportReviewColumns();

// Section names match ignoring case and extra spaces, so "Login " is the same
// section as "login".
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// One table row per case, with the warnings from its own rows: its first row up
// to (not including) the next case's first row. Row 1 warnings are file-level.
function toRows(staged: stagedImport, existingSections: Set<string>): importReviewRow[] {
	return staged.cases.map((testCase, i) => {
		const end = staged.cases[i + 1]?.row ?? Infinity;
		return {
			...testCase,
			id: String(testCase.row),
			isNewSection: !existingSections.has(normalizeName(testCase.sectionName)),
			warnings: staged.issues.filter((issue) => issue.row >= testCase.row && issue.row < end),
		};
	});
}

// Replaces the Test Cases tab while an import is staged. Nothing here is saved
// until "Add imported test cases".
export default function ImportReview({ existingSectionNames, suite }: { existingSectionNames: string[]; suite: { id: string; status: suiteStatus } }) {
	const { staged, discard } = useImportStaging();
	const [isSaving, startSaving] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState<string | null>(null);
	if (!staged) return null;

	// All or nothing: the RPC saves every case in one transaction. On success the
	// action refreshes the page, and discarding the staged file shows the list again.
	function saveImport() {
		if (!staged) return;
		setError(null);
		startSaving(async () => {
			const result = await importTestCases({ suiteId: suite.id, cases: staged.cases });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			const { created, sectionsCreated } = result.data;
			setSaved(`Imported ${plural(created, "test case")}${sectionsCreated ? ` and ${plural(sectionsCreated, "new section")}` : ""}.`);
			setTimeout(discard, 1500);
		});
	}

	const existingSections = new Set(existingSectionNames.map(normalizeName));
	const rows = toRows(staged, existingSections);
	const newSectionCount = new Set(rows.filter((row) => row.isNewSection).map((row) => normalizeName(row.sectionName))).size;
	const fileWarnings = staged.issues.filter((issue) => issue.row === 1);
	const sectionCount = new Set(staged.cases.map((testCase) => testCase.sectionName)).size;

	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="mx-auto w-full max-w-300 py-10 flex flex-col gap-4">
				<div className="flex flex-row items-center justify-between gap-4 rounded-md border bg-muted/30 p-4">
					<div className="">
						<p className="font-bold">Review Imported File</p>
						<p className="text-xs text-muted-foreground">
							This is a preview of the imported file. Please review the test cases and warnings before saving.
						</p>
						{suite.status === "in_testing" && (
							<p className="text-xs text-muted-foreground">New cases reach testers after you Sync.</p>
						)}
						{error && <p className="text-xs text-destructive">{error}</p>}
						{saved && <p className="text-xs text-emerald-600">{saved}</p>}
					</div>
					<div className="flex flex-row items-center gap-2">
						<Button variant="outline" size="lg" onClick={discard} disabled={isSaving || Boolean(saved)} className="text-xs">
							<X className="size-4" />
							Discard
						</Button>
						<Button size="lg" onClick={saveImport} disabled={isSaving || Boolean(saved) || !staged.cases.length} className="text-xs">
							<FilePlus className="size-4" />
							{isSaving ? "Adding…" : "Add imported test cases"}
						</Button>
					</div>
				</div>
				<div className="flex flex-row flex-wrap items-center justify-between gap-4 rounded-md border bg-muted/30 p-4">
					<div className="flex flex-row items-center gap-3">
						<div className="rounded-md bg-gray-500/10 p-2">
							<FileSpreadsheet className="size-4 text-muted-foreground" />
						</div>
						<div className="flex flex-col gap-0.5">
							<p className="text-sm font-semibold">Review import · {staged.fileName}</p>
							<p className="text-xs text-muted-foreground">
								{plural(staged.cases.length, "case")} · {plural(sectionCount, "section")}{newSectionCount ? ` (${newSectionCount} new)` : ""} · {plural(staged.issues.length, "warning")} · Not saved yet
							</p>
						</div>
					</div>
					{/* Reopens the import dialog; the current file stays staged until a new one is reviewed. */}
					<ImportUATTestCases
						trigger={
							<Button variant="outline" size="lg" className="text-xs">
								<Undo2 className="size-4" />
								Change File
							</Button>
						}
					/>
				</div>
				{fileWarnings.map((issue) => (
					<p key={issue.message} className="flex flex-row items-center gap-2 px-1 text-xs text-amber-600">
						<AlertTriangle className="size-3.5 shrink-0" />
						{issue.message}
					</p>
				))}
				<DataTable columns={columns} data={rows} />
			</div>
		</ScrollArea>
	);
}
