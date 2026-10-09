// Role Assignee values and admin-typed role names differ in spacing/case/dashes
// ("Action Officer" vs "Action-Officer"), so compare on letters and digits only.
export function sameRoleName(a: string | null | undefined, b: string | null | undefined): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return !!a && !!b && norm(a) === norm(b);
}
