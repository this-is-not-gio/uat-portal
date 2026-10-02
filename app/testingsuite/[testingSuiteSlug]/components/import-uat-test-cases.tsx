"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FilePlus, FileSpreadsheet, Upload } from "lucide-react";

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

export default function ImportUATTestCases() {
	const fileInput = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [rows, setRows] = useState<unknown[][] | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isReading, startReading] = useTransition();

	function pickFile(picked: File | undefined) {
		if (!picked) return;
		setFile(null);
		setRows(null);
		if (!ACCEPTED_EXTENSIONS.some((extension) => picked.name.toLowerCase().endsWith(extension))) {
			setError("Only .csv or .xlsx files are supported.");
			return;
		}
		setError(null);
		setFile(picked);
		startReading(async () => {
			try {
				const sheetRows = await readFirstSheet(picked);
				//console.log("[import] rows", sheetRows); // TEMP: Phase 1 check — remove before committing
				setRows(sheetRows);
			} catch {
				setFile(null);
				setError("Couldn't read that file. Check that it's a valid .csv or .xlsx file.");
			}
		});
	}

	return (
		<Dialog
			onOpenChange={(open) => {
				// Start fresh each time the dialog opens.
				if (open) {
					setFile(null);
					setRows(null);
					setError(null);
					// Start fetching SheetJS now so it's ready by the time a file is picked.
					void loadSheetJs();
				}
			}}
		>
			<DialogTrigger render={<Button className="flex flex-row items-center gap-2 text-xs">
				<FilePlus className="h-4 w-4" />
				Import Test Cases
			</Button>} />
			<DialogContent className="min-w-lg">
				<DialogHeader className="pt-2 px-2">
					<DialogTitle className="flex flex-row items-center">
						<FilePlus className="mr-2 h-4 w-4" />
						Import UAT Test Cases
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						This feature allows you to import UAT test cases from a CSV or XLSX file. Please ensure that the file is formatted correctly and contains all the necessary information for the test cases you wish to import.
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
								: rows
									? `${rows.length} ${rows.length === 1 ? "row" : "rows"} read · Click to choose a different file.`
									: "Drag and drop your CSV or XLSX file here, or click to select a file."}
						</p>
					</div>
				</button>
				{error && <p className="text-xs text-destructive px-2">{error}</p>}
			<DialogFooter className="flex flex-row items-center justify-end gap-2">
				<DialogClose render={<Button variant="outline" size="lg">Cancel</Button>}/>
				<Button variant="default" size="lg" disabled={!rows || isReading}>
					Import Test Cases
				</Button>
			</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
