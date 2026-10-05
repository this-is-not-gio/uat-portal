// Manual smoke test for draftThemes. Not part of the app; safe to delete.
// npx tsx --env-file=.env.local --conditions=react-server scripts/smoke-remark-themes.ts
import { draftThemes } from "../lib/report/remark-themes";
import type { ReportRemark } from "../lib/report/sign-off-remarks";

const base = { title: "Login", section: "Auth", priority: "high", organizationName: "Org A", roundName: "UAT 01", step: "Submit the form", stepNumber: 1, stepStatus: "failed" } as const;
const remarks: ReportRemark[] = [
    { ...base, id: "id-1", testCaseId: "tc-1", code: "TC-1", remark: "Login button does nothing on Safari." },
    { ...base, id: "id-2", testCaseId: "tc-2", code: "TC-2", remark: "On Safari the submit button is unresponsive." },
    { ...base, id: "id-3", testCaseId: "tc-3", code: "TC-3", section: "Claims", remark: "Claim amount field accepts negative numbers." },
    { ...base, id: "id-4", testCaseId: "tc-4", code: "TC-4", section: "Claims", remark: "Entered -500 as the claim amount and it saved." },
];

const known = new Set(remarks.map((r) => r.id));
draftThemes(remarks).then(
    ({ themes, model }) => {
        console.log(`model: ${model}, themes: ${themes.length}`);
        for (const t of themes) console.log(`\n- ${t.title}\n  ${t.summary}\n  cites: ${t.remarkIds.join(", ")}`);
        const bad = themes.flatMap((t) => t.remarkIds).filter((id) => !known.has(id));
        console.log(bad.length ? `\nFAIL: unknown ids ${bad.join(", ")}` : "\nPASS: every cited id is a real remark");
    },
    (e) => console.error("ERROR:", e instanceof Error ? e.message : e)
);
