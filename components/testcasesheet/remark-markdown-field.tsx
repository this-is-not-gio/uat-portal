"use client";

import { useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Paperclip, FileText, Loader2, X, Heading1, Heading2, Heading3, Italic, Link, Link2, Plus, List, ListCheck, ListOrdered, Quote, Send, Strikethrough, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
} from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { addResultRemark } from "@/lib/supabase/iteration-actions";
import { createAttachmentUpload, confirmAttachmentUpload, deleteDraftAttachment } from "@/lib/supabase/attachment-actions";
import { testRemark, testStep } from "@/lib/supabase/test-cases";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_DIMENSION = 1920;

// Images are always re-encoded as WebP no larger than 1920px (GIFs lose animation); PDFs pass through.
async function compressImage(file: File): Promise<File> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
	if (!blob || blob.type !== "image/webp") throw new Error("This browser could not compress the image.");
	const base = file.name.replace(/\.[^.]+$/, "") || "image";
	return new File([blob], `${base}.webp`, { type: "image/webp" });
}

function putWithProgress(url: string, file: File, signal: AbortSignal, onProgress: (pct: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		signal.addEventListener("abort", () => xhr.abort());
		xhr.onabort = () => reject(new Error("Upload cancelled."));
		xhr.open("PUT", url);
		xhr.setRequestHeader("Content-Type", file.type);
		xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
		xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
		xhr.onerror = () => reject(new Error("Upload failed (network error)."));
		xhr.send(file);
	});
}

const MAX_LINKS = 5;

// Evidence links are stored inside the remark text as a markdown list, so no schema change is needed.
function parseEvidenceLink(raw: string): { url: string; label: string } | null {
	const value = raw.trim();
	if (!value) return null;
	try {
		const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
		if (!url.hostname.includes(".")) return null;
		const host = url.hostname.replace(/^www\./, "");
		const label = host === "drive.google.com" || host === "docs.google.com" ? "Google Drive" : host;
		return { url: url.toString(), label };
	} catch {
		return null;
	}
}

// A file picked for this remark: uploading straight to the bucket, ready to post, or failed.
type uploadJob = { controller: AbortController; attachmentId?: string };

type draftFile = { localId: string; name: string; contentType: string; previewUrl?: string; progress?: number; state: "uploading" | "ready" | "error"; attachmentId?: string; error?: string };

const TOOLBAR_ACTIONS: {
	name: string;
	items: {
		label: string;
		Icon: LucideIcon;
		before: string;
		after: string;
	}[]
}[] = [
		{
			name: "Headings",
			items: [
				{ label: "Heading 1", Icon: Heading1, before: "# ", after: "" },
				{ label: "Heading 2", Icon: Heading2, before: "## ", after: "" },
				{ label: "Heading 3", Icon: Heading3, before: "### ", after: "" },
			],
		},
		{
			name: "Text Formatting",
			items: [
				{ label: "Bold", Icon: Bold, before: "**", after: "**" },
				{ label: "Italic", Icon: Italic, before: "_", after: "_" },
				{ label: "Strikethrough", Icon: Strikethrough, before: "~~", after: "~~" },
				{ label: "Code", Icon: Code, before: "`", after: "`" },
				{ label: "BlockQuote", Icon: Quote, before: "> ", after: "" },
			],

		},
		{
			name: "Lists",
			items: [
				{ label: "Unordered List", Icon: List, before: "- ", after: "" },
				{ label: "Ordered List", Icon: ListOrdered, before: "1. ", after: "" },
				{ label: "Task List", Icon: ListCheck, before: "- [ ] ", after: "" },
			],
		},
	];

// Remarks attach to a step of a running iteration (`step.id` is the
// test_step_results id); the author is set server-side.
export function RemarkMarkdownField({
	step,
	placeholder = "Leave a remark the tested step",
	requireEvidence = false,
	onSubmitted
}: {
	step: testStep
	placeholder?: string;
	// Failed steps: the remark can't be posted without a file or an evidence link.
	requireEvidence?: boolean;
	onSubmitted: (remark: testRemark) => void;
}): import("react").JSX.Element {
	const [draftText, setDraftText] = useState<string>("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [files, setFiles] = useState<draftFile[]>([]);
	const [fileError, setFileError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// In-flight upload per chip, so removing a chip can cancel it and find its draft id before state has it.
	const uploads = useRef(new Map<string, uploadJob>());
	const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
	const [linkDraft, setLinkDraft] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);
	const isEmpty = !draftText.trim() && links.length === 0;
	const uploading = files.some((f) => f.state === "uploading");
	const readyIds = files.flatMap((f) => (f.state === "ready" && f.attachmentId ? [f.attachmentId] : []));
	const hasEvidence = readyIds.length > 0 || links.length > 0;
	const canPost = (!isEmpty || readyIds.length > 0) && (!requireEvidence || hasEvidence) && !uploading && !files.some((f) => f.state === "error");

	function wrapSelection(before: string, after: string) {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const { selectionStart, selectionEnd } = textarea;
		const selected = draftText.slice(selectionStart, selectionEnd);
		const next =
			draftText.slice(0, selectionStart) + before + selected + after + draftText.slice(selectionEnd);
		setDraftText(next);
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(
				selectionStart + before.length,
				selectionStart + before.length + selected.length,
			);
		});
	}

	const [tab, setTab] = useState<"write" | "preview">("write");
	const [isPending, startTransition] = useTransition();
	const onSubmit = () => {
		if (!canPost) return;
		const evidence = links.length > 0 ? `**Evidence:**\n${links.map((link, i) => `- [Evidence ${i + 1} (${link.label})](${link.url})`).join("\n")}` : "";
		const text = [draftText.trim(), evidence].filter(Boolean).join("\n\n");

		startTransition(async () => {
			const result = await addResultRemark({ stepResultId: step.id, remark: text, attachmentIds: readyIds });
			if (!result.ok) {
				setFileError(result.error);
				return;
			}
			onSubmitted(result.data);
			files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
			setFiles([]);
			uploads.current.clear();
			setFileError(null);
			setDraftText("");
			setLinks([]);
			setLinkDraft("");
		})

	}

	function addLink() {
		if (links.length >= MAX_LINKS) return setLinkError(`A remark can have at most ${MAX_LINKS} links.`);
		const parsed = parseEvidenceLink(linkDraft);
		if (!parsed) return setLinkError("Enter a valid link, e.g. a Google Drive share link.");
		if (links.some((link) => link.url === parsed.url)) return setLinkError("That link is already added.");
		setLinks((current) => [...current, parsed]);
		setLinkDraft("");
		setLinkError(null);
	}

	function patchFile(localId: string, patch: Partial<draftFile>) {
		setFiles((current) => current.map((f) => (f.localId === localId ? { ...f, ...patch } : f)));
	}

	async function uploadFile(original: File, localId: string) {
		const job: uploadJob = { controller: new AbortController() };
		uploads.current.set(localId, job);
		const { signal } = job.controller;
		let file = original;
		if (original.type.startsWith("image/")) {
			try {
				file = await compressImage(original);
			} catch (e) {
				return patchFile(localId, { state: "error", error: (e as Error).message });
			}
			if (signal.aborted) return;
			patchFile(localId, { name: file.name, contentType: file.type });
		}
		const created = await createAttachmentUpload({ stepResultId: step.id, fileName: file.name, contentType: file.type, sizeBytes: file.size });
		if (!created.ok) return patchFile(localId, { state: "error", error: created.error });
		const attachmentId = created.data.attachment.id;
		job.attachmentId = attachmentId;
		// Removed while the draft row was being created: removeFile had no id to delete yet, so delete it here.
		if (signal.aborted) return void deleteDraftAttachment({ attachmentId });
		try {
			await putWithProgress(created.data.uploadUrl, file, signal, (progress) => patchFile(localId, { progress }));
		} catch (e) {
			if (signal.aborted) return; // removeFile already deleted the draft
			await deleteDraftAttachment({ attachmentId });
			return patchFile(localId, { state: "error", error: (e as Error).message });
		}
		const confirmed = await confirmAttachmentUpload({ attachmentId });
		if (!confirmed.ok) return patchFile(localId, { state: "error", error: confirmed.error, attachmentId });
		patchFile(localId, { state: "ready", attachmentId });
	}

	function addAttachment() {
		fileInputRef.current?.click();
	}

	function addFiles(picked: File[]) {
		// A file added while posting would be cleared on success with its upload still running.
		if (picked.length === 0 || isPending) return;
		setFileError(null);
		let room = MAX_FILES - files.length;
		const accepted: draftFile[] = [];
		for (const file of picked) {
			if (!ACCEPTED_TYPES.includes(file.type)) {
				setFileError("Only PNG, JPEG, WebP, GIF and PDF files can be attached.");
				continue;
			}
			if (file.size > MAX_BYTES) {
				setFileError(`${file.name} is over 10 MB.`);
				continue;
			}
			if (room <= 0) {
				setFileError(`A remark can have at most ${MAX_FILES} files.`);
				break;
			}
			room--;
			const localId = crypto.randomUUID();
			accepted.push({ localId, name: file.name, contentType: file.type, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined, progress: 0, state: "uploading" });
			void uploadFile(file, localId);
		}
		setFiles((current) => [...current, ...accepted]);
	}

	function onFilesPicked(picked: FileList | null) {
		addFiles(Array.from(picked ?? []));
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	// Win+Shift+S then Ctrl+V lands here as a clipboard image; pasted text is left alone.
	function onPaste(e: React.ClipboardEvent) {
		const pasted = Array.from(e.clipboardData.files);
		if (pasted.length === 0) return;
		e.preventDefault();
		addFiles(pasted);
	}

	const [dragging, setDragging] = useState(false);
	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		setDragging(false);
		addFiles(Array.from(e.dataTransfer.files));
	}

	async function removeFile(f: draftFile) {
		const job = uploads.current.get(f.localId);
		uploads.current.delete(f.localId);
		job?.controller.abort();
		setFiles((current) => current.filter((x) => x.localId !== f.localId));
		if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
		const attachmentId = job?.attachmentId ?? f.attachmentId;
		if (attachmentId) await deleteDraftAttachment({ attachmentId });
	}

	return (
		<div
			className={`flex rounded-lg border gap-0 min-w-0 ${dragging ? "border-primary ring-2 ring-primary/30" : ""}`}
			onPaste={onPaste}
			onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
			onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
			onDrop={onDrop}
		>
			<Tabs value={tab} onValueChange={(value) => setTab(value as "write" | "preview")} className="w-full min-w-0 gap-0">
				{/* Too wide for a phone: the toolbar stays one row and scrolls sideways. */}
				<div className="flex items-center justify-between gap-2 border-b p-2 bg-accent/50 overflow-x-auto">
					{
						TOOLBAR_ACTIONS.find(group => group.name === "Headings") &&
						<Select>
							<SelectTrigger className="w-28 sm:w-50 shrink-0 text-xs bg-white">
								<SelectValue placeholder="Headings" />
							</SelectTrigger>
							<SelectContent>
								{TOOLBAR_ACTIONS.find(group => group.name === "Headings")?.items.map((action) => (
									<SelectItem
										key={action.label}
										value={action.label}
										onClick={() => wrapSelection(action.before, action.after)}
										disabled={isPending || isEmpty}
									>
										<div className="flex items-center gap-2">
											<action.Icon className="h-3.5 w-3.5" />
											<p>{action.label}</p>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
					<div className="flex shrink-0 items-center gap-2 sm:gap-3 justify-center">
						{TOOLBAR_ACTIONS.map((group) => {
							const isHeadingGroup = group.name === "Headings";
							return isHeadingGroup ?
								null
								:
								<ButtonGroup key={group.name} className="bg-white shrink-0">
									{
										group.items.map((action, index) => (
											<Tooltip key={action.label}>
												<TooltipTrigger render={
													<Button
														key={action.label}
														type="button"
														variant="outline"
														size="icon-sm"
														title={action.label}
														onClick={() => wrapSelection(action.before, action.after)}
														disabled={isPending}
													>
														<action.Icon className="h-3.5 w-3.5" />
													</Button>
												} />
												<TooltipContent side="bottom" className="w-auto">
													<p className="text-xs">{action.label}</p>
												</TooltipContent>
											</Tooltip>
										))
									}
								</ButtonGroup>
						})}
						<div className="flex shrink-0 items-center gap-2 sm:gap-3 justify-center">
							<ButtonGroup className="bg-white shrink-0">
								<Tooltip>
									<TooltipTrigger render={
										<Button
											type="button"
											variant="outline"
											size="icon-sm"
											title="Link"
											onClick={() => wrapSelection("[", "](url)")}
											disabled={isPending}
										>
											<Link className="h-3.5 w-3.5" />
										</Button>
									} />
									<TooltipContent side="bottom" className="w-auto">
										<p className="text-xs">Link</p>
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger render={
										<Button
											type="button"
											variant="outline"
											size="icon-sm"
											title="Add Attachment"
											onClick={() => addAttachment()}
											disabled={isPending}
										>
											<Paperclip className="h-3.5 w-3.5" />
										</Button>
									} />
									<TooltipContent side="bottom" className="w-auto">
										<p className="text-xs">Add Attachment</p>
									</TooltipContent>
								</Tooltip>
							</ButtonGroup>
						</div>
					</div>
				</div>
				<TabsContent value="write" className="mt-0">
					<Textarea
						ref={textareaRef}
						value={draftText}
						onChange={(e) => setDraftText(e.target.value)}
						placeholder={placeholder}
						className="min-h-24 resize-none rounded-none border-0 shadow-none focus-visible:ring-0 p-3 sm:p-4 text-xs md:text-xs"
						disabled={isPending}
					/>
				</TabsContent>
				<TabsContent value="preview" className="mt-0 min-h-24 p-3 sm:p-4">
					{isEmpty ? (
						<p className="text-sm text-muted-foreground">Nothing to preview.</p>
					) : (
						<div className="typeset text-sm">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{draftText}</ReactMarkdown>
						</div>
					)}
				</TabsContent>

				<input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(",")} multiple hidden onChange={(e) => onFilesPicked(e.target.files)} />
				{(files.length > 0 || fileError) && (
					<div className="flex flex-col gap-2 border-t p-2 sm:p-3">
						{files.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{files.map((f) => (
									<div key={f.localId} title={f.error ?? f.name} className={`relative flex flex-col overflow-hidden rounded-md border bg-background text-xs max-w-48 ${f.state === "error" ? "border-destructive text-destructive" : ""}`}>
										<div className="flex items-center gap-2 p-1 pr-7">
										{f.previewUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={f.previewUrl} alt="" className="size-8 rounded object-cover" />
										) : (
											<FileText className="size-8 p-1.5 text-muted-foreground" />
										)}
										<span className="truncate">{f.name}</span>
										{f.state === "uploading" && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
										</div>
										{f.state === "uploading" && (
											<div className="h-1 w-full bg-muted" role="progressbar" aria-valuenow={f.progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
												<div className="h-full bg-primary transition-[width]" style={{ width: `${f.progress ?? 0}%` }} />
											</div>
										)}
										<button type="button" aria-label={`Remove ${f.name}`} onClick={() => removeFile(f)} disabled={isPending} className="absolute right-1 top-1 rounded p-0.5 hover:bg-accent">
											<X className="size-3" />
										</button>
									</div>
								))}
							</div>
						)}
						{fileError && <p className="text-xs text-destructive">{fileError}</p>}
					</div>
				)}

				<div className="flex flex-col gap-2 border-t p-2 sm:p-3">
					<p className="text-xs font-medium">Evidence links {requireEvidence && !hasEvidence ? <span className="font-normal text-destructive">(required for a failed step: add a link here or attach a file)</span> : <span className="font-normal text-muted-foreground">(e.g. a Google Drive link to a screen recording)</span>}</p>
					<div className="flex flex-row gap-2">
						<Input
							value={linkDraft}
							onChange={(e) => { setLinkDraft(e.target.value); setLinkError(null); }}
							onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
							placeholder="https://drive.google.com/…"
							className="text-xs md:text-xs"
							disabled={isPending}
						/>
						<Button type="button" variant="outline" size="sm" onClick={addLink} disabled={isPending || !linkDraft.trim()}>
							<Plus className="size-3.5" />
							Add link
						</Button>
					</div>
					{linkError && <p className="text-xs text-destructive">{linkError}</p>}
					{links.length > 0 && (
						<ul className="flex flex-wrap gap-2">
							{links.map((link) => (
								<li key={link.url} className="relative flex items-center gap-1.5 rounded-md border bg-background py-1 pl-2 pr-7 text-xs max-w-full" title={link.url}>
									<Link2 className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="truncate">{link.label}: {link.url}</span>
									<button type="button" aria-label={`Remove ${link.url}`} onClick={() => setLinks((current) => current.filter((l) => l.url !== link.url))} disabled={isPending} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-accent">
										<X className="size-3" />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="flex items-center justify-between gap-2 border-t p-2 sm:p-4">
					<TabsList>
						<TabsTrigger value="write" className="text-sm">Write</TabsTrigger>
						<TabsTrigger value="preview" className="text-sm">Preview</TabsTrigger>
					</TabsList>

					<div className="flex flex-row items-center gap-2">
						<Button type="button" variant="default" disabled={!canPost || isPending} onClick={onSubmit} className="flex items-center gap-1 px-3 sm:p-4">
							<Send size={16} className="ml-1" />
							<p>Add Remark</p>
						</Button>
					</div>
				</div>
			</Tabs>
		</div>
	);
}

