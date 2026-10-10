"use client";

import { testCasesHref } from "./href";
import { useRef, useState, useTransition } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FilePlus, FileSpreadsheet, Upload } from "lucide-react";
import { parseTestCaseRows } from "@/lib/import/parse-test-cases";
import { useImportStaging } from "./import-staging";
import { useTestRoleOptions } from "@/components/testsuite-layout/shared/test-role-options";
import { unmatchedRoleNames } from "@/lib/import/role-mapping";

type parsedImport = ReturnType<typeof parseTestCaseRows>;

// SheetJS is only fetched once the dialog opens, so it stays out of the page bundle.
let sheetJsPromise: Promise<typeof import("xlsx")> | null = null;
function loadSheetJs() {
	sheetJsPromise ??= import("xlsx");
	return sheetJsPromise;
}

// Reads the first sheet as rows of cell text. Blank rows are kept so a row's
// index + 1 is its spreadsheet row number.
async function readFirstSheet(file: File): Promise<unknown[][]> {
	const XLSX = await loadSheetJs();
	const isCsv = file.name.toLowerCase().endsWith(".csv");
	// CSV goes in as text (UTF-8 safe) with `raw` so values like "1/2" stay text instead of becoming dates.
	const workbook = isCsv
		? XLSX.read(await file.text(), { type: "string", raw: true })
		: XLSX.read(await file.arrayBuffer(), { type: "array" });
	const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
	if (!firstSheet) return [];
	return XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "", raw: false, blankrows: true });
}

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];

// `trigger` replaces the default "Import Test Cases" button (e.g. "Change File" in the review).
// `section` imports every case into that section instead of the file's section rows.
export default function ImportUATTestCases({ trigger, section }: { trigger?: React.ReactElement; section?: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const { testSuiteSlug } = useParams<{ testSuiteSlug: string }>();
	const { stage } = useImportStaging();
	const roleOptions = useTestRoleOptions();
	const [open, setOpen] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [parsed, setParsed] = useState<parsedImport | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isReading, startReading] = useTransition();

	function pickFile(picked: File | undefined) {
		if (!picked) return;
		setFile(null);
		setParsed(null);
		if (!ACCEPTED_EXTENSIONS.some((extension) => picked.name.toLowerCase().endsWith(extension))) {
			setError("Only .csv or .xlsx files are supported.");
			return;
		}
		setError(null);
		setFile(picked);
		startReading(async () => {
			try {
				setParsed(parseTestCaseRows(await readFirstSheet(picked), [...roleOptions.internal, ...roleOptions.external], section));
			} catch {
				setFile(null);
				setError("Couldn't read that file. Check that it's a valid .csv or .xlsx file.");
			}
		});
	}

	const hasErrors = parsed?.issues.some((issue) => issue.severity === "error") ?? false;

	// Hands the parsed cases to the Test Cases tab for review; nothing is saved yet.
	function reviewImport() {
		if (!file || !parsed || hasErrors) return;
		stage({ fileName: file.name, section: section ?? null, cases: parsed.cases, issues: parsed.issues });
		setOpen(false);
		// A section import reviews on the section's own page; otherwise on All Sections.
		router.push(section ? pathname : testCasesHref(testSuiteSlug, "all"));
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				// Start fresh each time the dialog opens.
				if (nextOpen) {
					setFile(null);
					setParsed(null);
					setError(null);
					// Start fetching SheetJS now so it's ready by the time a file is picked.
					void loadSheetJs();
				}
			}}
		>
			<DialogTrigger render={trigger ?? <Button className="flex flex-row items-center gap-2 text-xs">
				<FilePlus className="h-4 w-4" />
				Import Test Cases
			</Button>} />
			<DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader className="pt-2 px-2">
					<DialogTitle className="flex flex-row items-center">
						<FilePlus className="mr-2 h-4 w-4" />
						{section ? `Importing Test Cases for ${section}` : "Import UAT Test Cases"}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						This feature allows you to import UAT test cases from a CSV or XLSX file. Please ensure that the file is formatted correctly and contains all the necessary information for the test cases you wish to import.
						{section && ` Every test case in the file goes into ${section}; section rows aren't needed.`}
					</DialogDescription>
				</DialogHeader>
				<input
					ref={fileInput}
					type="file"
					accept=".csv,.xlsx"
					className="hidden"
					onChange={(event) => {
						pickFile(event.target.files?.[0]);
						// Clear it so choosing the same file again still fires onChange.
						event.target.value = "";
					}}
				/>
				<button
					type="button"
					onClick={() => fileInput.current?.click()}
					disabled={isReading}
					onDragOver={(event) => {
						event.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={(event) => {
						event.preventDefault();
						setIsDragging(false);
						pickFile(event.dataTransfer.files[0]);
					}}
					className={cn(
						"flex flex-col gap-4 border-2 border-dashed p-2 min-h-40 rounded-md bg-gray-200/20 items-center justify-center w-full cursor-pointer transition-colors",
						isDragging && "border-primary bg-primary/5"
					)}
				>
					<div className="bg-gray-500/10 rounded-md p-2">
						{file ? <FileSpreadsheet className="size-4 text-muted-foreground" /> : <Upload className="size-4 text-muted-foreground" />}
					</div>
					<div className="flex flex-col items-center justify-center gap-1">
						<p className="font-semibold">{file ? file.name : "Upload CSV or XLSX File"}</p>
						<p className="text-xs text-muted-foreground">
							{isReading
								? "Reading…"
								: parsed
									? "Click to choose a different file."
									: "Drag and drop your CSV or XLSX file here, or click to select a file."}
						</p>
					</div>
				</button>
				{error && <p className="text-xs text-destructive px-2">{error}</p>}
				{parsed && !isReading && <ImportSummary parsed={parsed} section={section} />}
			<DialogFooter className="flex flex-row items-center justify-end gap-2">
				<DialogClose render={<Button variant="outline" size="lg" className="flex-1 sm:flex-none">Cancel</Button>}/>
				<Button variant="default" size="lg" className="flex-1 sm:flex-none" disabled={!parsed || !parsed.cases.length || hasErrors || isReading} onClick={reviewImport}>
					Review import
				</Button>
			</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Under the drop zone: what the file holds, then each error by row so the user
// knows what to fix in the spreadsheet. Warnings are listed in the review instead.
function ImportSummary({ parsed, section }: { parsed: parsedImport; section?: string }) {
	const sectionCount = new Set(parsed.cases.map((testCase) => testCase.sectionName)).size;
	const errors = parsed.issues.filter((issue) => issue.severity === "error");
	const errorCount = errors.length;
	const warningCount = parsed.issues.length - errorCount;
	const unmatchedRoleCount = unmatchedRoleNames(parsed.cases).length;

	return (
		<div className="flex flex-col gap-1 px-2">
			<p className="font-semibold text-xs">Possible Test Cases:</p>
			<p className="flex flex-row flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
				<span>{plural(parsed.cases.length, "case")}</span>
				<span>·</span>
				<span>{section ? `into ${section}` : plural(sectionCount, "section")}</span>
				<span>·</span>
				<span className={cn(errorCount && "text-destructive font-medium")}>{plural(errorCount, "error")}</span>
				<span>·</span>
				<span className={cn(warningCount && "text-amber-600 font-medium")}>{plural(warningCount, "warning")}</span>
				{unmatchedRoleCount > 0 && (
					<>
						<span>·</span>
						<span className="text-destructive font-medium">{plural(unmatchedRoleCount, "role name")} to map in the review</span>
					</>
				)}
			</p>
			{errorCount > 0 && (
				<div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md bg-destructive/5 p-3">
					<p className="text-xs font-semibold text-destructive">Fix these in the file, then choose it again:</p>
					<ul className="flex flex-col gap-1 text-xs">
						{errors.map((issue, i) => (
							<li key={i} className="flex flex-row gap-2">
								<span className="shrink-0 font-mono text-muted-foreground">{issue.row === 1 && !issue.column ? "File" : `Row ${issue.row}`}</span>
								<span>{issue.column ? `${issue.column}: ` : ""}{issue.message}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
