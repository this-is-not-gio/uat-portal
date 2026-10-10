// Manual smoke test for import role matching. Not part of the app; safe to delete.
// npx tsx scripts/smoke-import-roles.ts
import { parseTestCaseRows } from "../lib/import/parse-test-cases";
import { applyRoleMappings, unmatchedRoleNames } from "../lib/import/role-mapping";

const officer = { id: "role-officer", name: "Action Officer" };
const approver = { id: "role-approver", name: "Approver" };

const header = ["TEST CASE", "PRECONDITION", "STEP TO EXECUTE", "EXPECTED RESULT", "ASSIGNED ROLE"];
const rows = [
    header,
    ["Login"],
    ["Case 1", "", "Open", "Opens", "Action-Officer"],
    ["Case 2", "", "Open", "Opens", "action officer"],
    ["Case 3", "", "Open", "Opens", "ACTION OFFICER"],
    ["Case 4", "", "Open", "Opens", "Aprover"],
    ["Case 5", "", "Open", "Opens", "aprover "],
    ["Case 6", "", "Open", "Opens", "Supervisor"],
    ["Case 7", "", "Open", "Opens", ""],
    ["Case 8", "", "Open", "Opens", "-"],
];

let failures = 0;
const check = (label: string, ok: boolean) => {
    console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
    if (!ok) failures++;
};

const { cases, issues } = parseTestCaseRows(rows, [officer, approver]);
const byTitle = (title: string) => cases.find((c) => c.title === title)!;

check("spelling variants all match the same catalog role",
    ["Case 1", "Case 2", "Case 3"].every((t) => byTitle(t).testRoleId === officer.id && byTitle(t).unmatchedRole === null));
check("unmatched names are kept on the case", byTitle("Case 4").testRoleId === null && byTitle("Case 4").unmatchedRole === "Aprover");
check("unmatched names are not errors (the file still stages)", !issues.some((i) => i.severity === "error"));
check("a blank role is neither matched nor unmatched", ["Case 7", "Case 8"].every((t) => byTitle(t).testRoleId === null && byTitle(t).unmatchedRole === null));

const unmatched = unmatchedRoleNames(cases);
check("one entry per distinct unmatched name", JSON.stringify(unmatched.map((u) => u.name)) === JSON.stringify(["Aprover", "Supervisor"]));
check("each entry counts its cases", unmatched[0]?.caseCount === 2 && unmatched[1]?.caseCount === 1);

const partial = applyRoleMappings(cases, { [unmatched[0].key]: approver });
check("a mapping applies to every case with that name",
    ["Case 4", "Case 5"].every((t) => { const c = partial.find((p) => p.title === t)!; return c.testRoleId === approver.id && c.roleAssignee === approver.name && c.unmatchedRole === null; }));
check("unmapped names stay unmatched, so saving stays blocked", unmatchedRoleNames(partial).map((u) => u.name).join() === "Supervisor");

const full = applyRoleMappings(cases, { [unmatched[0].key]: approver, [unmatched[1].key]: officer });
check("no unmatched names once every name is mapped, so saving unblocks", unmatchedRoleNames(full).length === 0);
check("every role-named case ends up with a catalog role", full.filter((c) => !["Case 7", "Case 8"].includes(c.title)).every((c) => c.testRoleId));

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exitCode = failures ? 1 : 0;
