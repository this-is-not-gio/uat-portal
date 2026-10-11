"use client";

import { useState } from "react";
import { FileText, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { listRemarkAttachments, type signedAttachment } from "@/lib/supabase/attachment-actions";

export function formatSize(bytes: number): string {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Signed links live 10 minutes (lib/storage/b2.ts). Reusing the same URLs within that window keeps
// the browser cache valid, so reopening a case or switching tabs doesn't re-download thumbnails.
const CACHE_MS = 8 * 60 * 1000;
const cache = new Map<string, { at: number; files: Record<string, signedAttachment[]> }>();

export async function loadRemarkAttachments(stepResultIds: string[]): Promise<{ ok: true; data: Record<string, signedAttachment[]> } | { ok: false }> {
	const key = stepResultIds.join(",");
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, data: hit.files };
	const res = await listRemarkAttachments({ stepResultIds });
	if (!res.ok) return { ok: false };
	cache.set(key, { at: Date.now(), files: res.data });
	return { ok: true, data: res.data };
}

// Posting adds files the cached listing doesn't have.
export function invalidateRemarkAttachments() {
	cache.clear();
}

export const ATTACHMENTS_UNAVAILABLE = "Attachments are temporarily unavailable. Try again later.";

export function AttachmentsUnavailable({ className = "" }: { className?: string }) {
	return (
		<p className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
			<ImageOff className="size-3.5" />
			{ATTACHMENTS_UNAVAILABLE}
		</p>
	);
}

// Images as lazy thumbnails opening a lightbox; PDFs as chips opening in a new tab.
// A thumbnail B2 refuses (daily cap, expired link) is hidden behind the notice instead of showing broken.
export function RemarkAttachments({ attachments }: { attachments: signedAttachment[] }) {
	const [lightbox, setLightbox] = useState<signedAttachment | null>(null);
	const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());
	if (attachments.length === 0) return null;
	const shown = attachments.filter((a) => !brokenIds.has(a.id));
	return (
		<>
			<div className="mt-3 flex flex-wrap gap-2 empty:hidden">
				{shown.map((a) =>
					a.kind === "image" ? (
						<button key={a.id} type="button" onClick={() => setLightbox(a)} title={a.fileName} className="rounded-md focus-visible:ring-2 focus-visible:ring-ring">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={a.url} alt={a.fileName} loading="lazy" decoding="async" onError={() => setBrokenIds((current) => new Set(current).add(a.id))} className="size-24 rounded-md border object-cover" />
						</button>
					) : (
						<a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex max-w-56 items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent">
							<FileText className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate">{a.fileName}</span>
							<span className="shrink-0 text-muted-foreground">{formatSize(a.sizeBytes)}</span>
						</a>
					),
				)}
			</div>
			{brokenIds.size > 0 && <AttachmentsUnavailable className="mt-3" />}
			<Dialog open={lightbox !== null} onOpenChange={(open) => { if (!open) setLightbox(null); }}>
				<DialogContent className="sm:max-w-4xl">
					<DialogTitle className="truncate">{lightbox?.fileName}</DialogTitle>
					{lightbox && (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={lightbox.url} alt={lightbox.fileName} className="max-h-[75vh] w-full object-contain" />
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
