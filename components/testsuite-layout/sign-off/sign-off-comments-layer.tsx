"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { MessageSquarePlus, Pencil, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BADGE_VARIANTS } from "@/components/sidebar/app-sidebar";
import { cn } from "cn";
import { anchorFromRange, rangeFromAnchor, type commentAnchor } from "@/lib/report/comment-anchor";
import { addSignOffComment, deleteSignOffComment, replySignOffComment, updateSignOffComment } from "@/lib/supabase/sign-off-comment-actions";
import type { signOffComment } from "@/lib/supabase/sign-off-comments";

// Google-Docs-style comments for the report sheets. Rendered as the right-hand margin of the sheets
// column (positioned absolutely from its left edge), so the cards scroll with the pages and stay
// unscaled under zoom: their tops are measured in screen pixels from the highlighted text.
// The client (canComment) highlights text in comment mode and a button offers a comment on it; the
// vendor only reads. Highlights use the CSS Custom Highlight API, so the server-rendered sheets stay untouched.

export type signOffComments = {
	signOffId: string;
	items: signOffComment[];
	// The client, while the report awaits their decision: can add comments and delete their own.
	canComment: boolean;
	currentUserId: string;
};

type draft = { page: number; anchor: commentAnchor; range: Range };
type selection = { page: number; anchor: commentAnchor; range: Range; top: number };

const GAP = 8;
const NO_ANCHOR = Number.MAX_SAFE_INTEGER;

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function AuthorAvatar({ comment, className }: { comment: signOffComment; className?: string }) {
	const variant = BADGE_VARIANTS[comment.authorOrgType as keyof typeof BADGE_VARIANTS] ?? BADGE_VARIANTS.fallback;
	return (
		<div className={cn("flex shrink-0 items-center justify-center rounded-full", variant.UserClassName, className)}>
			<p className="font-bold text-white">{initials(comment.authorName)}</p>
		</div>
	);
}

const formatTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function setHighlight(name: string, ranges: Range[]) {
	if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
	if (ranges.length === 0) CSS.highlights.delete(name);
	else CSS.highlights.set(name, new Highlight(...ranges));
}

// The text range under a click, if the browser can tell.
function rangeAtPoint(x: number, y: number): Range | null {
	const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
	if (doc.caretPositionFromPoint) {
		const pos = doc.caretPositionFromPoint(x, y);
		if (!pos) return null;
		const range = document.createRange();
		range.setStart(pos.offsetNode, pos.offset);
		return range;
	}
	return document.caretRangeFromPoint?.(x, y) ?? null;
}

export function SignOffCommentsLayer({ comments, commenting, sheetRefs, sheetsRef, layoutKey }: {
	comments: signOffComments;
	commenting: boolean;
	sheetRefs: React.RefObject<(HTMLDivElement | null)[]>;
	sheetsRef: React.RefObject<HTMLDivElement | null>;
	// Anything that moves the text (zoom, pageless): changing it re-measures the cards.
	layoutKey: string;
}) {
	const { items: allItems, canComment, currentUserId, signOffId } = comments;
	// Top-level comments anchor to text and get a card; replies hang off their parent's card.
	const items = useMemo(() => allItems.filter((c) => !c.parentId), [allItems]);
	const repliesOf = useMemo(() => {
		const map = new Map<string, signOffComment[]>();
		for (const c of allItems) if (c.parentId) map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]);
		return map;
	}, [allItems]);
	const containerRef = useRef<HTMLDivElement>(null);
	// A stable Map (not a ref) so card elements can be tracked from callback refs without reading `.current` in render.
	const [cardRefs] = useState(() => new Map<string, HTMLElement>());
	const rangesRef = useRef(new Map<string, Range | null>());
	const [tick, setTick] = useState(0);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [selectionState, setSelection] = useState<selection | null>(null);
	const [draftState, setDraft] = useState<draft | null>(null);
	// Leaving comment mode drops the selection button and any unsent comment.
	const selection = commenting && canComment ? selectionState : null;
	const draft = commenting ? draftState : null;
	const [anchoredIds, setAnchoredIds] = useState<Set<string>>(() => new Set());
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
	const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
	const [pending, startTransition] = useTransition();
	const [tops, setTops] = useState<Record<string, number>>({});

	const sheetOf = useCallback((node: Node) => {
		const sheets = sheetRefs.current;
		const page = sheets.findIndex((sheet) => sheet?.contains(node));
		return page === -1 ? null : { page, sheet: sheets[page]! };
	}, [sheetRefs]);

	// Find every comment's text in its sheet, and paint the highlights.
	useLayoutEffect(() => {
		const map = new Map<string, Range | null>();
		for (const c of items) {
			const sheet = sheetRefs.current[c.page];
			map.set(c.id, sheet ? rangeFromAnchor(sheet, c) : null);
		}
		rangesRef.current = map;
		// Measuring the DOM, then re-rendering with the result, is what this effect is for.
		/* eslint-disable react-hooks/set-state-in-effect */
		setAnchoredIds(new Set([...map].filter(([, r]) => r).map(([id]) => id)));
		setTick((n) => n + 1);
		/* eslint-enable react-hooks/set-state-in-effect */
	}, [items, sheetRefs]);

	useEffect(() => {
		const all = [...rangesRef.current.entries()];
		setHighlight("sign-off-comment", all.filter(([id, r]) => r && id !== activeId).map(([, r]) => r!));
		setHighlight("sign-off-comment-active", [rangesRef.current.get(activeId ?? "") ?? draft?.range].filter((r): r is Range => !!r));
		return () => { setHighlight("sign-off-comment", []); setHighlight("sign-off-comment-active", []); };
	}, [tick, activeId, draft]);

	// Text moves when the sheets resize (zoom, window, pageless): measure again.
	useEffect(() => {
		const sheets = sheetsRef.current;
		if (!sheets) return;
		const observer = new ResizeObserver(() => setTick((n) => n + 1));
		observer.observe(sheets);
		return () => observer.disconnect();
	}, [sheetsRef]);

	// The comment button follows the selection in comment mode.
	useEffect(() => {
		if (!commenting || !canComment) return;
		const onChange = () => {
			const sel = document.getSelection();
			const container = containerRef.current;
			if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !container) { setSelection(null); return; }
			const range = sel.getRangeAt(0);
			const found = sheetOf(range.commonAncestorContainer);
			const anchor = found && anchorFromRange(found.sheet, range);
			if (!found || !anchor) { setSelection(null); return; }
			setSelection({ page: found.page, anchor, range: range.cloneRange(), top: range.getBoundingClientRect().top - container.getBoundingClientRect().top });
		};
		document.addEventListener("selectionchange", onChange);
		return () => document.removeEventListener("selectionchange", onChange);
	}, [commenting, canComment, sheetOf]);

	// Clicking highlighted text opens its comment.
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (containerRef.current?.contains(event.target as Node)) return;
			if (!document.getSelection()?.isCollapsed) return;
			const point = rangeAtPoint(event.clientX, event.clientY);
			if (!point) return;
			for (const [id, range] of rangesRef.current) {
				if (range && range.isPointInRange(point.startContainer, point.startOffset)) { setActiveId(id); return; }
			}
			setActiveId(null);
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);

	// Stack the cards: each at its text's top, pushed down past the card above it.
	// Runs after every render; the state only changes when a card actually moves.
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const origin = container.getBoundingClientRect().top;
		const entries: { id: string; natural: number }[] = items.map((c) => {
			const range = rangesRef.current.get(c.id);
			return { id: c.id, natural: range ? range.getBoundingClientRect().top - origin : NO_ANCHOR };
		});
		if (draft) entries.push({ id: "draft", natural: draft.range.getBoundingClientRect().top - origin });
		entries.sort((a, b) => a.natural - b.natural);
		const next: Record<string, number> = {};
		let bottom = 0;
		for (const entry of entries) {
			const top = Math.max(entry.natural === NO_ANCHOR ? 0 : entry.natural, bottom);
			next[entry.id] = top;
			bottom = top + (cardRefs.get(entry.id)?.offsetHeight ?? 0) + GAP;
		}
		setTops((current) => {
			const keys = Object.keys(next);
			return keys.length === Object.keys(current).length && keys.every((k) => Math.abs(next[k] - (current[k] ?? -1)) < 0.5) ? current : next;
		});
	});

	// layoutKey is read so a zoom or pageless change re-renders this layer (the layout effect above re-measures).
	void layoutKey;

	const open = () => {
		if (!selection) return;
		setDraft({ page: selection.page, anchor: selection.anchor, range: selection.range });
		setActiveId(null);
		setText("");
		setError(null);
		document.getSelection()?.removeAllRanges();
	};

	const submit = () => {
		if (!draft) return;
		startTransition(async () => {
			const result = await addSignOffComment({ signOffId, page: draft.page, ...draft.anchor, body: text });
			if (!result.ok) { setError(result.error); return; }
			setDraft(null);
			setText("");
			setError(null);
			setActiveId(result.data.id);
		});
	};

	const saveEdit = () => {
		if (!editing) return;
		startTransition(async () => {
			const result = await updateSignOffComment({ commentId: editing.id, body: editing.text });
			if (!result.ok) { toast.error(result.error); return; }
			setEditing(null);
		});
	};

	const sendReply = (parentId: string) => {
		const body = replyDrafts[parentId] ?? "";
		startTransition(async () => {
			const result = await replySignOffComment({ parentId, body });
			if (!result.ok) { toast.error(result.error); return; }
			setReplyDrafts((current) => ({ ...current, [parentId]: "" }));
		});
	};

	const remove = (id: string) => {
		startTransition(async () => {
			const result = await deleteSignOffComment({ commentId: id });
			if (!result.ok) toast.error(result.error);
			else if (activeId === id) setActiveId(null);
		});
	};

	const focus = (id: string) => {
		setActiveId(id);
		rangesRef.current.get(id)?.startContainer.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
	};

	const register = (id: string) => (el: HTMLElement | null) => {
		if (el) cardRefs.set(id, el);
		else cardRefs.delete(id);
	};

	return (
		<div ref={containerRef} className="absolute top-0 left-full ml-6 w-72 print:hidden">
			{selection && !draft && (
				<Button
					size="icon-sm"
					variant="outline"
					aria-label="Add comment"
					title="Comment on selection"
					className="absolute left-0 bg-background shadow-sm"
					style={{ top: selection.top }}
					// Keep the text selected while the button is pressed.
					onMouseDown={(event) => event.preventDefault()}
					onClick={open}
				>
					<MessageSquarePlus />
				</Button>
			)}

			{draft && (
				<div ref={register("draft")} className="absolute w-full rounded-lg border bg-background p-3 shadow-md ring-1 ring-amber-400" style={{ top: tops.draft ?? 0 }}>
					<Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" maxLength={2000} className="min-h-16 text-xs" />
					{error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
					<div className="mt-2 flex justify-end gap-2">
						<Button size="sm" variant="ghost" disabled={pending} onClick={() => { setDraft(null); setText(""); setError(null); }}>Cancel</Button>
						<Button size="sm" disabled={pending || !text.trim()} onClick={submit}>Comment</Button>
					</div>
				</div>
			)}

			{items.map((c) => {
				const active = activeId === c.id;
				const anchored = anchoredIds.has(c.id);
				const isEditing = editing?.id === c.id;
				return (
					<div
						key={c.id}
						ref={register(c.id)}
						role="button"
						tabIndex={0}
						onClick={() => focus(c.id)}
						onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); focus(c.id); } }}
						className={cn("absolute w-full cursor-pointer rounded-lg border bg-background p-3 text-xs shadow-sm transition-[top,box-shadow] duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring/50", active && "shadow-md ring-1 ring-amber-400")}
						style={{ top: tops[c.id] ?? 0 }}
					>
						<div className="flex items-start gap-2">
							<AuthorAvatar comment={c} className="size-8 text-xs" />
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium">{c.authorName}</p>
								<p className="text-[11px] text-muted-foreground">{formatTime(c.createdAt)}</p>
							</div>
							{canComment && c.authorId === currentUserId && !isEditing && (
								<div className="flex shrink-0">
									<Button variant="ghost" size="icon-sm" aria-label="Edit comment" title="Edit" disabled={pending} onClick={(event) => { event.stopPropagation(); setEditing({ id: c.id, text: c.body }); }}>
										<Pencil />
									</Button>
									<Button variant="ghost" size="icon-sm" aria-label="Delete comment" title="Delete" disabled={pending} onClick={(event) => { event.stopPropagation(); remove(c.id); }}>
										<Trash2 />
									</Button>
								</div>
							)}
						</div>
						{!anchored && <p className="mt-1 text-[11px] text-muted-foreground">This text is no longer in the report.</p>}
						{isEditing ? (
							<div className="mt-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
								<Textarea autoFocus value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} maxLength={2000} className="min-h-16 text-xs" />
								<div className="mt-2 flex justify-end gap-2">
									<Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button>
									<Button size="sm" disabled={pending || !editing.text.trim() || editing.text.trim() === c.body} onClick={saveEdit}>Save</Button>
								</div>
							</div>
						) : (
							<p className="mt-2 whitespace-pre-wrap break-words">{c.body}</p>
						)}

						{(repliesOf.get(c.id) ?? []).map((r) => (
							<div className="" key={r.id} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
								<div className="mt-3 flex items-start gap-2 pt-3">
									<AuthorAvatar comment={r} className="size-8 text-[11px]" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1">
											<p className="min-w-0 flex-1 truncate font-medium">{r.authorName}</p>
											{canComment && r.authorId === currentUserId && (
												<Button variant="ghost" size="icon-sm" aria-label="Delete reply" title="Delete" disabled={pending} onClick={(event) => { event.stopPropagation(); remove(r.id); }}>
													<Trash2 />
												</Button>
											)}
										</div>
										<p className="text-[11px] text-muted-foreground">{formatTime(r.createdAt)}</p>
									</div>

								</div>
								<p className="mt-2 whitespace-pre-wrap break-words">{r.body}</p>
							</div>
						))}

						{canComment && (
							<div className="mt-3 flex items-end gap-2 pt-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
								<Textarea
									value={replyDrafts[c.id] ?? ""}
									onChange={(e) => setReplyDrafts((current) => ({ ...current, [c.id]: e.target.value }))}
									placeholder="Reply"
									maxLength={2000}
									className="min-h-8 text-xs"
								/>
								<Button size="icon-lg" aria-label="Send reply" title="Send" disabled={pending || !(replyDrafts[c.id] ?? "").trim()} onClick={() => sendReply(c.id)}>
									<SendHorizontal />
								</Button>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
