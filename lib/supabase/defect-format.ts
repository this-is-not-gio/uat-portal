// Pure helpers shared by the defects data module, its actions and the client UI.

export const defectCode = (number: number) => `DEF-${String(number).padStart(3, "0")}`;

// DEF-001-TC-1-s-2: defect code, first cited case, first cited step. Steps are 1-based ("000" when none, or overall feedback).
export const defectRef = (d: { code: string; primaryCase: { caseCode: string | null } | null; references: { stepOrder: number | null }[] }) => {
    const step = d.references[0]?.stepOrder;
    return `${d.code}-${d.primaryCase?.caseCode ?? "000"}-${step != null ? `s-${step + 1}` : "000"}`;
};

// Same rule the defect functions enforce (0082): blank is fine, otherwise an http(s) URL with a dotted host.
export function externalUrlError(value: string): string | null {
    const url = value.trim();
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (/^https?:$/.test(parsed.protocol) && parsed.hostname.includes(".")) return null;
    } catch {
        // falls through
    }
    return "Enter a valid link (https://...).";
}

export const DEFECT_SEVERITIES = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
] as const;

export const DEFECT_STATUS_LABELS = { open: "Open", resolved: "Closed", wont_fix: "Won't fix" } as const;
