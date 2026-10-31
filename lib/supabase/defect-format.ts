// Pure helpers shared by the defects data module, its actions and the client UI.

export const defectCode = (number: number) => `DEF-${String(number).padStart(3, "0")}`;

// DEF-001-TC-1-s-2: defect code, source case, first cited step ("000" when there is none).
export const defectRef = (d: { code: string; caseCode: string | null; references: { stepOrder: number | null }[] }) =>
    `${d.code}-${d.caseCode}-${d.references[0]?.stepOrder ? `s-${d.references[0].stepOrder}` : "000"}`;

// Same rule create_defect enforces (0080): blank is fine, otherwise an http(s) URL with a dotted host.
export function jiraUrlError(value: string): string | null {
    const url = value.trim();
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (/^https?:$/.test(parsed.protocol) && parsed.hostname.includes(".")) return null;
    } catch {
        // falls through
    }
    return "Enter a valid Jira link (https://...).";
}

export const DEFECT_SEVERITIES = [
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
] as const;

export const DEFECT_STATUS_LABELS = { open: "Open", resolved: "Closed", wont_fix: "Won't fix" } as const;
