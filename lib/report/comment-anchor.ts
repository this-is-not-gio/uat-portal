// Text anchors for sign-off comments. The report is server-rendered React, so a comment can't live
// in the markup. It stores the quoted text plus a few characters either side, and the viewer finds
// that text again in the sheet (and highlights it with the CSS Custom Highlight API, no DOM changes).
// Offsets are into the sheet's text, as Range.toString() joins its text nodes.

export type commentAnchor = { quote: string; prefix: string; suffix: string };

const CONTEXT = 32;
export const MAX_QUOTE = 500;

function textOf(root: Node): string {
    const range = document.createRange();
    range.selectNodeContents(root);
    return range.toString();
}

// The selection as an anchor within `root` (a sheet), or null if it's collapsed, blank or leaves the sheet.
export function anchorFromRange(root: HTMLElement, range: Range): commentAnchor | null {
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const raw = range.toString();
    const lead = raw.length - raw.trimStart().length;
    const quote = raw.trim().slice(0, MAX_QUOTE);
    if (!quote) return null;
    const start = before.toString().length + lead;
    const text = textOf(root);
    return { quote, prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(start + quote.length, start + quote.length + CONTEXT) };
}

// How many characters of the stored context match the text around a candidate, nearest first.
function contextScore(text: string, at: number, anchor: commentAnchor): number {
    let score = 0;
    for (let i = 1; i <= anchor.prefix.length && text[at - i] === anchor.prefix[anchor.prefix.length - i]; i++) score++;
    const end = at + anchor.quote.length;
    for (let i = 0; i < anchor.suffix.length && text[end + i] === anchor.suffix[i]; i++) score++;
    return score;
}

// The Range of the anchored text in `root`, or null when it can't be found. If the quote appears
// more than once, the occurrence whose surrounding text matches best wins.
export function rangeFromAnchor(root: HTMLElement, anchor: commentAnchor): Range | null {
    const text = textOf(root);
    let best = -1, bestScore = -1;
    for (let at = text.indexOf(anchor.quote); at !== -1; at = text.indexOf(anchor.quote, at + 1)) {
        const score = contextScore(text, at, anchor);
        if (score > bestScore) { best = at; bestScore = score; }
    }
    if (best === -1) return null;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const end = best + anchor.quote.length;
    let pos = 0, started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.nodeValue?.length ?? 0;
        if (!started && best < pos + length) { range.setStart(node, best - pos); started = true; }
        if (started && end <= pos + length) { range.setEnd(node, end - pos); return range; }
        pos += length;
    }
    return null;
}
