"use client";

import { useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Paperclip, FileText, Loader2, X, Heading1, Heading2, Heading3, Italic, Link, Link2, List, ListCheck, ListOrdered, Quote, Send, Strikethrough, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url);
		xhr.setRequestHeader("Content-Type", file.type);
		xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
		xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
		xhr.onerror = () => reject(new Error("Upload failed (network error)."));
		xhr.send(file);
	});
}

// A file picked for this remark: uploading straight to the bucket, ready to post, or failed.
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
	onSubmitted
}: {
	step: testStep
	placeholder?: string;
	onSubmitted: (remark: testRemark) => void;
}): import("react").JSX.Element {
	const [draftText, setDraftText] = useState<string>("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [files, setFiles] = useState<draftFile[]>([]);
	const [fileError, setFileError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const isEmpty = !draftText.trim();
	const uploading = files.some((f) => f.state === "uploading");
	const readyIds = files.flatMap((f) => (f.state === "ready" && f.attachmentId ? [f.attachmentId] : []));
	const canPost = (!isEmpty || readyIds.length > 0) && !uploading && !files.some((f) => f.state === "error");

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
		const text = draftText.trim();
		if (!canPost) return;

		startTransition(async () => {
			const result = await addResultRemark({ stepResultId: step.id, remark: text, attachmentIds: readyIds });
			if (!result.ok) {
				setFileError(result.error);
				return;
			}
			onSubmitted(result.data);
			files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
			setFiles([]);
			setFileError(null);
			setDraftText("");
		})

	}

	function patchFile(localId: string, patch: Partial<draftFile>) {
		setFiles((current) => current.map((f) => (f.localId === localId ? { ...f, ...patch } : f)));
	}

	async function uploadFile(original: File, localId: string) {
		let file = original;
		if (original.type.startsWith("image/")) {
			try {
				file = await compressImage(original);
			} catch (e) {
				return patchFile(localId, { state: "error", error: (e as Error).message });
			}
			patchFile(localId, { name: file.name, contentType: file.type });
		}
		const created = await createAttachmentUpload({ stepResultId: step.id, fileName: file.name, contentType: file.type, sizeBytes: file.size });
		if (!created.ok) return patchFile(localId, { state: "error", error: created.error });
		const attachmentId = created.data.attachment.id;
		try {
			await putWithProgress(created.data.uploadUrl, file, (progress) => patchFile(localId, { progress }));
		} catch (e) {
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
		if (picked.length === 0) return;
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
		setFiles((current) => current.filter((x) => x.localId !== f.localId));
		if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
		if (f.attachmentId) await deleteDraftAttachment({ attachmentId: f.attachmentId });
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

