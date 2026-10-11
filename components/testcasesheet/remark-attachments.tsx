"use client";

import { FileText } from "lucide-react";
import type { signedAttachment } from "@/lib/supabase/attachment-actions";

function formatSize(bytes: number): string {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Images as thumbnails, PDFs as file chips; both open the signed link in a new tab.
export function RemarkAttachments({ attachments }: { attachments: signedAttachment[] }) {
	if (attachments.length === 0) return null;
	return (
		<div className="mt-3 flex flex-wrap gap-2">
			{attachments.map((a) =>
				a.kind === "image" ? (
					<a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.fileName}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={a.url} alt={a.fileName} loading="lazy" className="size-24 rounded-md border object-cover" />
					</a>
				) : (
					<a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex max-w-56 items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent">
						<FileText className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate">{a.fileName}</span>
						<span className="shrink-0 text-muted-foreground">{formatSize(a.sizeBytes)}</span>
					</a>
				),
			)}
		</div>
	);
}
