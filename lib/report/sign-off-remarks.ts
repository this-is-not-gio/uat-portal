// Tester remarks and observation themes in the sign-off report (Phase 5).
// Pure and client-safe: used by the builder on the server, the theme editor in the dialog and
// the report page. Every shape here is frozen into suite_sign_offs.report, so it's plain JSON.

type Priority = "low" | "medium" | "high";

// One tester remark behind a case's final result. id is the test_remarks id.
export type ReportRemark = {
    id: string;
    testCaseId: string;
    code: string | null;
    title: string;
    section: string;
    priority: Priority;
    organizationName: string;
    roundName: string;
    step: string;
    // 1-based position of the step in the case.
    stepNumber: number;
    stepStatus: string;
    remark: string;
};

// A vendor-written observation. Quotes are whole remarks cited by id, never typed text.
export type ReportTheme = { id: string; title: string; summary: string; remarkIds: string[] };

// source leaves room for "ai" drafts later without reshaping the frozen report.
export type ReportThemes = { source: "manual"; items: ReportTheme[] };

// What the dialog sends to issueSignOff; validated against a catalog rebuilt on the server.
export type ThemeInput = ReportTheme;

export const THEME_LIMITS = { maxThemes: 20, maxTitle: 120, maxSummary: 1000 } as const;

export const STALE_REMARK_ERROR = "A cited remark no longer exists. Reload the preview.";

export type RemarkGroup = {
    section: string;
    cases: { testCaseId: string; code: string | null; title: string; priority: Priority; remarks: ReportRemark[] }[];
};

// Section -> case -> remark, keeping the catalog's order. Computed at render, not stored.
export function groupRemarks(remarks: ReportRemark[]): RemarkGroup[] {
    const groups: RemarkGroup[] = [];
    for (const remark of remarks) {
        let group = groups.find((g) => g.section === remark.section);
        if (!group) {
            group = { section: remark.section, cases: [] };
            groups.push(group);
        }
        let entry = group.cases.find((c) => c.testCaseId === remark.testCaseId);
        if (!entry) {
            entry = { testCaseId: remark.testCaseId, code: remark.code, title: remark.title, priority: remark.priority, remarks: [] };
            group.cases.push(entry);
        }
        entry.remarks.push(remark);
    }
    return groups;
}

// The first problem with one theme, or null. Shared by the editor (inline hint) and validateThemes.
export function themeProblem(theme: ThemeInput): string | null {
    const title = theme.title.trim();
    if (!title) return "needs a title";
    if (title.length > THEME_LIMITS.maxTitle) return `title is over ${THEME_LIMITS.maxTitle} characters`;
    if (theme.summary.trim().length > THEME_LIMITS.maxSummary) return `summary is over ${THEME_LIMITS.maxSummary} characters`;
    if (theme.remarkIds.length === 0) return "needs at least one cited remark";
    return null;
}

// Rejects bad input with a message rather than dropping it: a person wrote it and should see what's wrong.
export function validateThemes(
    input: ThemeInput[],
    catalog: ReportRemark[]
): { ok: true; themes: ReportTheme[] } | { ok: false; error: string } {
    if (!Array.isArray(input)) return { ok: false, error: "Observations are malformed." };
    if (input.length > THEME_LIMITS.maxThemes) return { ok: false, error: `At most ${THEME_LIMITS.maxThemes} observations.` };
    const known = new Set(catalog.map((r) => r.id));
    const themes: ReportTheme[] = [];
    for (const [i, raw] of input.entries()) {
        if (typeof raw?.title !== "string" || typeof raw?.summary !== "string" || !Array.isArray(raw?.remarkIds)) {
            return { ok: false, error: `Observation ${i + 1} is malformed.` };
        }
        const theme: ReportTheme = {
            id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
            title: raw.title.trim(),
            summary: raw.summary.trim(),
            remarkIds: [...new Set(raw.remarkIds.filter((id): id is string => typeof id === "string"))],
        };
        const problem = themeProblem(theme);
        if (problem) return { ok: false, error: `Observation ${i + 1} ${problem}.` };
        if (theme.remarkIds.some((id) => !known.has(id))) return { ok: false, error: STALE_REMARK_ERROR };
        themes.push(theme);
    }
    return { ok: true, themes };
}
