"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, DownloadIcon, Info, MessageSquare, MoveHorizontal, PanelLeftClose, PanelLeftOpen, PrinterIcon, ScrollText, Settings2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";

// PDF-style viewer for the Sign-off tab: a sticky toolbar over A4 sheets on a grey canvas.
// The sheets are placeholders until the report blocks render into them.
// Zoom uses CSS zoom (not transform) so the scroll height follows the zoomed size; print resets it.
// Pageless joins the sheets into one continuous document (like Google Docs); zoom is off there.
// Layout (like Google Docs): the canvas fills the whole tab and scrolls both ways; the panels float
// over it (absolute), so zooming never squeezes the sheets between side columns.

const A4_WIDTH_PX = 794; // 210mm at 96dpi
const CANVAS_PADDING_PX = 48;
const ZOOM_STEPS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5]; // max 150%
const PAGELESS_KEY = "sign-off-document:pageless";

// Pageless preference in localStorage, read through useSyncExternalStore. Storage can be blocked
// (private mode), so every access falls back to paged.
const pagelessListeners = new Set<() => void>();
function subscribePageless(listener: () => void) {
	pagelessListeners.add(listener);
	return () => pagelessListeners.delete(listener);
}
function readPageless() {
	try {
		return localStorage.getItem(PAGELESS_KEY) === "1";
	} catch {
		return false;
	}
}
function writePageless(on: boolean) {
	try {
		localStorage.setItem(PAGELESS_KEY, on ? "1" : "0");
	} catch { }
	pagelessListeners.forEach((listener) => listener());
}

// pages: server-rendered content, one sheet each. Sheets past it stay placeholders up to pageCount.
// A null page has nothing to report: it's left off the paper and its section is disabled in the nav.
// versions: the version picker for the side panel. sections: one nav label per page, same order.
// rightPanel: content for the right-hand panel; a placeholder shows until it's passed.
// issueAction: the Issue Report button, passed only while the vendor's draft is open.
// notice: the open version's status strip, shown above the first sheet (screen only).
// info: sign-off details for the collapsible bottom-right panel.
export function SignOffDocument({ leading, versions, sections = [], rightPanel, issueAction, notice, info, pages = [], pageCount = 3 }: { leading?: React.ReactNode; versions?: React.ReactNode; sections?: string[]; rightPanel?: React.ReactNode; issueAction?: React.ReactNode; notice?: React.ReactNode; info?: React.ReactNode; pages?: (React.ReactNode | null)[]; pageCount?: number }) {
	pageCount = Math.max(pageCount, pages.length);
	const canvasRef = useRef<HTMLDivElement>(null);
	// The canvas's track: its side padding is the room fit-width leaves around the sheet.
	const trackRef = useRef<HTMLDivElement>(null);
	// The zoomed wrapper around the sheets, measured to keep the zoom centred.
	const sheetsRef = useRef<HTMLDivElement>(null);
	// The sheet point (unzoomed) at the canvas centre when the user changed the zoom; put back in the centre after.
	const zoomFocus = useRef<{ x: number; y: number } | null>(null);
	const [panelOpen, setPanelOpen] = useState(true);
	const [infoOpen, setInfoOpen] = useState(true);
	const sheetRefs = useRef<(HTMLDivElement | null)[]>([]);
	const [zoom, setZoom] = useState(1);
	const [fitWidth, setFitWidth] = useState(true);
	const [page, setPage] = useState(1);
	// Remembered per browser; the server renders paged and hydration switches to the saved choice.
	const pageless = useSyncExternalStore(subscribePageless, readPageless, () => false);

	// Fit width: scale an A4 sheet to the canvas, never above 100% so text stays crisp.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !fitWidth || pageless) return;
		const fit = () => {
			const track = trackRef.current;
			const reserved = track ? parseFloat(getComputedStyle(track).paddingLeft) + parseFloat(getComputedStyle(track).paddingRight) : CANVAS_PADDING_PX;
			setZoom(Math.min(1, Math.max(ZOOM_STEPS[0], (canvas.clientWidth - reserved) / A4_WIDTH_PX)));
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(canvas);
		return () => observer.disconnect();
	}, [fitWidth, pageless]);

	// Current page: the last sheet whose top has passed the middle of the canvas (the scroll container).
	useEffect(() => {
		const viewport = canvasRef.current;
		if (!viewport) return;
		const track = () => {
			const middle = viewport.getBoundingClientRect().top + viewport.clientHeight / 2;
			let current = 1;
			sheetRefs.current.forEach((sheet, i) => {
				if (sheet && sheet.getBoundingClientRect().top <= middle) current = i + 1;
			});
			setPage(current);
		};
		track();
		viewport.addEventListener("scroll", track, { passive: true });
		return () => viewport.removeEventListener("scroll", track);
	}, [pageCount, zoom, pageless]);

	// Zoom from the centre, like a docs viewer: before a zoom change, remember which sheet point sits in
	// the middle of the canvas...
	const keepCentre = () => {
		const canvas = canvasRef.current, sheets = sheetsRef.current;
		if (!canvas || !sheets || pageless) return;
		const c = canvas.getBoundingClientRect(), s = sheets.getBoundingClientRect();
		zoomFocus.current = { x: (c.left + c.width / 2 - s.left) / zoom, y: (c.top + c.height / 2 - s.top) / zoom };
	};

	// ...then scroll so that point is back in the middle at the new zoom (before paint, so nothing jumps).
	useLayoutEffect(() => {
		const canvas = canvasRef.current, sheets = sheetsRef.current, point = zoomFocus.current;
		if (!canvas || !sheets || !point) return;
		zoomFocus.current = null;
		const c = canvas.getBoundingClientRect(), s = sheets.getBoundingClientRect();
		canvas.scrollLeft += s.left + point.x * zoom - (c.left + c.width / 2);
		canvas.scrollTop += s.top + point.y * zoom - (c.top + c.height / 2);
	}, [zoom]);

	const goTo = useCallback((target: number) => {
		sheetRefs.current[target - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
	}, []);

	const stepZoom = (direction: 1 | -1) => {
		keepCentre();
		setFitWidth(false);
		setZoom((current) => {
			const next = direction === 1 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001);
			return next ?? current;
		});
	};

	const unit = pageless ? "Section" : "Page";

	return (
		// The frame: fills the suite's scroll area. The canvas covers it and scrolls (both ways when zoomed);
		// the panels float above at fixed corners, so they never move with the pages.
		<div className={cn("relative h-full overflow-hidden print:static print:block print:h-auto print:overflow-visible print:bg-transparent", pageless ? "bg-white" : "bg-gray-200/10")}>
			{/* Toolbar: sticks to the top of the suite's ScrollArea while the pages scroll under it. */}
			{/* <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur sm:px-6 print:hidden">
				<div className="min-w-0 flex-1">{leading ?? <p className="truncate text-sm font-medium">Sign-off report</p>}</div>

				<ButtonGroup>
					<Button variant="outline" size="icon-sm" aria-label={`Previous ${unit.toLowerCase()}`} disabled={page <= 1} onClick={() => goTo(page - 1)}>
						<ChevronUp />
					</Button>
					<ButtonGroupText className="h-7 min-w-20 justify-center text-xs tabular-nums">
						{unit} {page} / {pageCount}
					</ButtonGroupText>
					<Button variant="outline" size="icon-sm" aria-label={`Next ${unit.toLowerCase()}`} disabled={page >= pageCount} onClick={() => goTo(page + 1)}>
						<ChevronDown />
					</Button>
				</ButtonGroup>

				<div className="flex flex-1 items-center justify-end gap-2">
					<ButtonGroup>
						<Button variant="outline" size="icon-sm" aria-label="Zoom out" disabled={pageless || zoom <= ZOOM_STEPS[0]} onClick={() => stepZoom(-1)}>
							<ZoomOut />
						</Button>
						<ButtonGroupText className="h-7 w-14 justify-center text-xs tabular-nums">{pageless ? "—" : `${Math.round(zoom * 100)}%`}</ButtonGroupText>
						<Button variant="outline" size="icon-sm" aria-label="Zoom in" disabled={pageless || zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => stepZoom(1)}>
							<ZoomIn />
						</Button>
					</ButtonGroup>
					<Button
						variant={fitWidth ? "secondary" : "outline"}
						size="icon-sm"
						aria-label="Fit to width"
						aria-pressed={fitWidth}
						title="Fit to width"
						disabled={pageless}
						onClick={() => setFitWidth((on) => !on)}
					>
						<MoveHorizontal />
					</Button>
					<Button variant={pageless ? "secondary" : "outline"} size="sm" aria-pressed={pageless} title="Pageless: one continuous document" onClick={togglePageless}>
						<ScrollText />
						<span className="hidden sm:inline">Pageless</span>
					</Button>
					<Separator orientation="vertical" className="mx-1 h-5" />
					<Button variant="outline" size="sm" disabled title="Comments are coming soon">
						<MessageSquare />
						<span className="hidden sm:inline">Comments</span>
					</Button>
					<Button size="sm" onClick={() => window.print()}>
						<DownloadIcon />
						<span className="hidden sm:inline">Download PDF</span>
					</Button>
				</div>
			</div> */}

			{/* Settings panel: report version + a jump list of the sections + view. Floats over the canvas's
			    top-left corner and scrolls on its own; collapses to a button. It only overlays the canvas (no track
			    padding), so opening or collapsing it never moves the sheets. */}
			{!panelOpen && (
				<Button variant="outline" size="icon" aria-label="Show report settings" title="Report settings" className="absolute top-5 left-5 z-20 bg-background shadow-sm print:hidden" onClick={() => setPanelOpen(true)}>
					<PanelLeftOpen />
				</Button>
			)}
			<aside className={cn("absolute top-5 left-5 z-20 max-h-[calc(100%-2.5rem)] w-64 flex-col gap-2 overflow-y-auto no-scrollbar rounded-lg border bg-background shadow-sm print:hidden", panelOpen ? "flex" : "hidden")}>
				<div className="flex items-center gap-2 text-sm font-medium pt-4 px-4">
					<Button variant="ghost" size="icon-sm" aria-label="Hide report settings" title="Hide" onClick={() => setPanelOpen(false)}>
						<PanelLeftClose />
					</Button>
					<span className="flex-1">Report settings</span>
				</div>

				{versions && (
					<div className="flex flex-col gap-1.5 px-4 py-2">
						<p className="text-xs font-medium text-muted-foreground">Version</p>
						{versions}
					</div>
				)}

				{sections.length > 0 && (
					<>
						<Separator />
						<nav aria-label="Report sections" className="flex flex-col gap-1.5 px-4 pt-2 pb-4">
							<p className="text-xs font-medium text-muted-foreground">Sections</p>
							<ol className="-mx-1 flex flex-col gap-0.5 px-1">
								{sections.map((label, i) => {
									const empty = pages[i] === null;
									const active = !empty && page === i + 1;
									return (
										<li key={label} className="shrink-0">
											<button
												type="button"
												disabled={empty}
												title={empty ? "Nothing to report" : undefined}
												aria-current={active ? "location" : undefined}
												onClick={() => goTo(i + 1)}
												className={cn(
													"flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs whitespace-nowrap transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
													active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
												)}
											>
												<span
													className={cn(
														"flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums transition-colors",
														active ? "border-foreground bg-foreground text-background" : "border-border",
													)}
												>
													{i + 1}
												</span>
												{label}
											</button>
										</li>
									);
								})}
							</ol>
						</nav>
					</>
				)}

				<Separator />
				{/* View: zoom (paged only, pageless always fills the width) and the pageless toggle. */}
				<div className="flex flex-col gap-2 px-4 pt-2 pb-4">
					<p className="text-xs font-medium text-muted-foreground">View</p>
					<div className="flex items-center gap-2">
						<ButtonGroup className="flex-1">
							<Button variant="outline" size="icon-sm" aria-label="Zoom out" disabled={pageless || zoom <= ZOOM_STEPS[0]} onClick={() => stepZoom(-1)}>
								<ZoomOut />
							</Button>
							<ButtonGroupText className="h-7 w-full justify-center text-xs tabular-nums">{pageless ? "—" : `${Math.round(zoom * 100)}%`}</ButtonGroupText>
							<Button variant="outline" size="icon-sm" aria-label="Zoom in" disabled={pageless || zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => stepZoom(1)}>
								<ZoomIn />
							</Button>
						</ButtonGroup>
						<Button
							variant={fitWidth ? "secondary" : "outline"}
							size="icon-sm"
							aria-label="Fit to width"
							aria-pressed={fitWidth}
							title="Fit to width"
							disabled={pageless}
							onClick={() => { keepCentre(); setFitWidth((on) => !on); }}
						>
							<MoveHorizontal />
						</Button>
					</div>
					<Label className="mt-1 flex cursor-pointer items-center gap-2 text-xs font-normal hover:bg-muted/50">
						<ScrollText className="size-3.5 text-muted-foreground" />
						<span className="flex flex-1 flex-col gap-0.5">
							<span className="font-medium">Pageless</span>
							<span className="text-[11px] text-muted-foreground">One continuous document</span>
						</span>
						<Switch size="sm" checked={pageless} onCheckedChange={writePageless} />
					</Label>
				</div>
			</aside>

			{/* Canvas: covers the frame and scrolls both ways. The track is at least as wide as the canvas and
			    grows with the zoomed sheets (w-max), so zooming past the width scrolls sideways instead of clipping.
			    The floating panels overlay it; mx-auto centres the sheets. Scrollbars are hidden (it still scrolls).
			    Pageless: no paper at all; the canvas turns white and the sections flow on it, split by a rule. */}
			<div ref={canvasRef} className="no-scrollbar absolute inset-0 overflow-auto print:static print:overflow-visible">
				<div ref={trackRef} className="flex w-max min-w-full px-6 pt-20 print:block print:w-auto print:p-0">
				{/* Column: the notice over the sheets. The notice is sized by the sheets (w-0 min-w-full), so long
				    text wraps instead of widening the column; it isn't zoomed, so it stays readable at any zoom. */}
				<div className={cn("mx-auto flex flex-col gap-4 print:block", pageless ? "w-full max-w-5xl" : "w-fit")}>
				{notice && <div className="w-0 min-w-full print:hidden">{notice}</div>}
				<div
					ref={sheetsRef}
					style={pageless ? undefined : ({ "--doc-zoom": zoom } as React.CSSProperties)}
					className={cn(
						// Print: the zero-margin sign-off page (globals.css) drops the browser's header and footer, so the
							// 14mm margin is padding here; box-decoration-clone repeats it on every printed page. Table rows never split across pages.
							"mx-auto flex flex-col print:gap-0 print:p-[14mm] print:[page:sign-off] print:box-decoration-clone print:[zoom:1] print:[&_tr]:break-inside-avoid",
						pageless
							? "mb-8 w-full max-w-5xl divide-y print:my-0 print:w-full print:max-w-none"
							: "w-fit gap-6 pb-8 [zoom:var(--doc-zoom)]",
					)}
				>
					{Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => pages[n - 1] !== null).map((n) => (
						<div
							key={n}
							ref={(el) => { sheetRefs.current[n - 1] = el; }}
							className={cn(
								"flex scroll-mt-16 flex-col",
								pageless
									? "px-6 py-10 sm:px-[12mm]"
									: // At least one A4 page tall; a section longer than that grows the sheet rather than overflowing it.
								// Print: the sheets wrapper carries the paper margin, so the sheet drops its size and padding; each section
								// starts a new page, with no blank page after the last one.
									"min-h-[297mm] w-[210mm] bg-white p-[12mm] print:bg-transparent shadow-sm ring-1 ring-black/5 print:min-h-0 print:w-auto print:p-0 print:break-after-page print:shadow-none print:ring-0 print:last:break-after-auto",
							)}
						>
							{pages[n - 1] ?? (
								<div className={cn("flex flex-1 items-center justify-center rounded-md border border-dashed border-stone-300", pageless && "min-h-40")}>
									<p className="text-xs text-muted-foreground">{unit} {n}</p>
								</div>
							)}
						</div>
					))}
				</div>
				</div>
				</div>
			</div>

			{/* Actions: a floating toolbar at the canvas's top-right corner; labels hide on narrow screens. */}
			<aside className="absolute top-5 right-5 z-20 flex flex-row gap-2 rounded-lg border bg-background p-2 shadow-sm print:hidden">
				{rightPanel ?? (
					<>
						<Button variant="outline" className="w-fit" title="Right panel is coming soon">
							<MessageSquare />
							<span className="hidden sm:inline text-xs">Comments</span>
						</Button>
						<Button variant="outline" className="w-fit" title="Print or save as PDF" onClick={() => window.print()}>
							<PrinterIcon />
							<span className="hidden sm:inline text-xs">Print Report</span>
						</Button>
						{issueAction}
					</>
				)}
			</aside>

			{/* Sign-off details: floats over the canvas's bottom-right corner like the settings panel (no track
			    padding, so collapsing it never moves the sheets); collapses to a button. */}
			{info && (infoOpen ? (
				<aside className="absolute right-5 bottom-5 z-20 flex max-h-[calc(100%-7rem)] w-72 flex-col overflow-y-auto no-scrollbar rounded-lg border bg-background shadow-sm print:hidden">
					<div className="flex items-center gap-2 px-4 pt-4 text-sm font-medium">
						<Info className="size-4 text-muted-foreground" />
						<span className="flex-1">Sign-off details</span>
						<Button variant="ghost" size="icon-sm" aria-label="Hide sign-off details" title="Hide" onClick={() => setInfoOpen(false)}>
							<ChevronDown />
						</Button>
					</div>
					<div className="px-4 pt-2 pb-4">{info}</div>
				</aside>
			) : (
				<Button variant="outline" size="icon" aria-label="Show sign-off details" title="Sign-off details" className="absolute right-5 bottom-5 z-20 bg-background shadow-sm print:hidden" onClick={() => setInfoOpen(true)}>
					<Info />
				</Button>
			))}
		</div>
	);
}
