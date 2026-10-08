import type { suiteEndpoint, suiteOverviewSection, suiteTestAccount } from "@/lib/supabase/test-accounts";

// Vendor-added sections on the report's "Report details" page, below the participants
// (e.g. Testing Guidelines, or a copy of an Overview card). Saved on the draft (report->sections)
// and frozen into the report by issueSignOff.

export type ReportSection = { id: string; title: string; markdown: string };

export const SECTION_LIMITS = { maxSections: 10, maxTitle: 80, maxMarkdown: 10_000 } as const;

// The first problem with one section, or null. Shared by the editor (inline hint) and validateSections.
export function sectionProblem(section: Pick<ReportSection, "title" | "markdown">): string | null {
    const title = section.title.trim();
    if (!title) return "needs a title";
    if (title.length > SECTION_LIMITS.maxTitle) return `title is over ${SECTION_LIMITS.maxTitle} characters`;
    if (section.markdown.trim().length > SECTION_LIMITS.maxMarkdown) return `content is over ${SECTION_LIMITS.maxMarkdown} characters`;
    return null;
}

// Rejects bad input with a message rather than dropping it, like validateThemes.
export function validateSections(input: unknown): { ok: true; sections: ReportSection[] } | { ok: false; error: string } {
    if (!Array.isArray(input)) return { ok: false, error: "Report sections are malformed." };
    if (input.length > SECTION_LIMITS.maxSections) return { ok: false, error: `At most ${SECTION_LIMITS.maxSections} report sections.` };
    const sections: ReportSection[] = [];
    for (const [i, raw] of input.entries()) {
        if (typeof raw?.title !== "string" || typeof raw?.markdown !== "string") return { ok: false, error: `Report section ${i + 1} is malformed.` };
        const section: ReportSection = {
            id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
            title: raw.title.trim(),
            markdown: raw.markdown.trim(),
        };
        const problem = sectionProblem(section);
        if (problem) return { ok: false, error: `Report section ${i + 1} ${problem}.` };
        sections.push(section);
    }
    return { ok: true, sections };
}

// Overview content the vendor can copy into the report as a section. It's a snapshot in Markdown,
// so an issued report never changes when the Overview does; the vendor can edit it after adding.
// Empty cards are still listed so the menu shows what exists (the menu disables them).
export type OverviewTemplate = { key: string; label: string; title: string; markdown: string };

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export function overviewTemplates({ description, testAccounts, endpoints, sections }: { description: string | null; testAccounts: suiteTestAccount[]; endpoints: suiteEndpoint[]; sections: suiteOverviewSection[] }): OverviewTemplate[] {
    return [
        { key: "description", label: "Description", title: "Description", markdown: description?.trim() ?? "" },
        {
            key: "test_accounts",
            label: "Test accounts",
            title: "Test accounts",
            // Passwords stay out: the report is shared and printed.
            markdown: testAccounts.length > 0 ? ["| Role | Username / Email |", "| --- | --- |", ...testAccounts.map((a) => `| ${cell(a.role ?? "—")} | ${cell(a.username)} |`)].join("\n") : "",
        },
        { key: "endpoints", label: "Endpoints", title: "Endpoints", markdown: endpoints.map((e) => `- **${e.name}**: ${e.url}`).join("\n") },
        ...sections.map((s) => ({ key: `section:${s.id}`, label: s.title, title: s.title, markdown: s.content.trim() })),
    ];
}
