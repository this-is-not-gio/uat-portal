// `guide` is the legacy pages' URL prefix (/manual/guide/...), so no module may take it.
export const RESERVED_MODULE_SLUGS = ["guide"];

export function slugify(title: string): string {
    return title
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// First free slug for a title: "sec-endorsement", then "sec-endorsement-2", "-3", ...
export function uniqueSlug(title: string, taken: Iterable<string>, reserved: string[] = [], fallback = "module"): string {
    const base = slugify(title) || fallback;
    const used = new Set([...taken, ...reserved]);
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
}

// One anchor id per block header, in page order. Duplicate headers get "-2", "-3", ... like slugs do.
export function blockAnchors(headers: string[]): string[] {
    const taken: string[] = [];
    return headers.map((header) => {
        const anchor = uniqueSlug(header, taken, [], "section");
        taken.push(anchor);
        return anchor;
    });
}
