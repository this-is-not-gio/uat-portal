"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// The browser's print dialog does the PDF ("Save as PDF"); @media print in globals.css hides the app chrome.
export function PrintButton() {
	return (
		<Button onClick={() => window.print()} className="print:hidden">
			<DownloadIcon />
			Download PDF
		</Button>
	);
}
