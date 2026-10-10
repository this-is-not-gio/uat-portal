// Role names differ in spacing/case/dashes ("Action Officer" vs "Action-Officer"),
// so compare on letters and digits only.
export const normalizeRoleName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function sameRoleName(a: string | null | undefined, b: string | null | undefined): boolean {
    return !!a && !!b && normalizeRoleName(a) === normalizeRoleName(b);
}
