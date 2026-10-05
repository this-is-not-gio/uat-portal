import "server-only";
import Groq from "groq-sdk";
import { THEME_LIMITS, themeProblem, type ReportRemark, type ThemeInput } from "./sign-off-remarks";

// AI-drafted observation themes for the sign-off report. Drafts only: the admin reviews them in
// the theme editor, and issueSignOff validates them like hand-written ones.

// Must support json_schema structured output on Groq. Override with GROQ_MODEL.
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You group UAT tester remarks into observation themes for a sign-off report.
Rules:
- Each theme collects remarks that describe the same issue, behaviour or area.
- Cite remarks only by the ids given (r1, r2, ...). Every theme cites at least one remark.
- A remark may be cited by more than one theme, but prefer one.
- Title: short and factual, under ${THEME_LIMITS.maxTitle} characters.
- Summary: neutral description of what testers reported, under 400 characters.
- No pass/fail judgement, severity rating, blame or recommendation. Don't invent details not in the remarks.
- Return at most 8 themes. Skip remarks that say nothing beyond "ok" or "passed".`;

const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        themes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    remarkIds: { type: "array", items: { type: "string" } },
                },
                required: ["title", "summary", "remarkIds"],
                additionalProperties: false,
            },
        },
    },
    required: ["themes"],
    additionalProperties: false,
};

export type ThemeDraft = { themes: ThemeInput[]; model: string };

// Throws on a missing key or API failure; the caller decides how to fail soft.
// Bad output is dropped, not reported: nobody wrote it, so there's no one to show the error to.
export async function draftThemes(remarks: ReportRemark[]): Promise<ThemeDraft> {
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
    if (remarks.length === 0) return { themes: [], model };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set.");

    // Short aliases instead of UUIDs: fewer tokens, and an invented id is easy to spot.
    const byAlias = new Map(remarks.map((r, i) => [`r${i + 1}`, r.id]));
    const input = remarks.map((r, i) => ({
        id: `r${i + 1}`,
        case: r.code ?? r.title,
        section: r.section,
        priority: r.priority,
        stepStatus: r.stepStatus,
        step: r.step,
        remark: r.remark,
    }));

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(input) },
        ],
        response_format: {
            type: "json_schema",
            json_schema: { name: "observation_themes", strict: true, schema: RESPONSE_SCHEMA },
        },
    });

    return { themes: parseThemes(completion.choices[0]?.message?.content, byAlias), model };
}

function parseThemes(content: string | null | undefined, byAlias: Map<string, string>): ThemeInput[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content ?? "");
    } catch {
        return [];
    }
    const raw = (parsed as { themes?: unknown })?.themes;
    if (!Array.isArray(raw)) return [];

    const themes: ThemeInput[] = [];
    for (const item of raw) {
        if (typeof item?.title !== "string" || typeof item?.summary !== "string" || !Array.isArray(item?.remarkIds)) continue;
        const remarkIds = [
            ...new Set(
                item.remarkIds
                    .map((alias: unknown) => (typeof alias === "string" ? byAlias.get(alias) : undefined))
                    .filter((id: string | undefined): id is string => !!id)
            ),
        ] as string[];
        const theme: ThemeInput = { id: crypto.randomUUID(), title: item.title.trim(), summary: item.summary.trim(), remarkIds };
        if (themeProblem(theme)) continue;
        themes.push(theme);
        if (themes.length === THEME_LIMITS.maxThemes) break;
    }
    return themes;
}
