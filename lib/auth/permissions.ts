import type { currentUser } from "@/lib/supabase/auth";

// TS mirror of the permission matrix (RBAC playbook §0). Server actions check it first so the
// user gets a clear message; the DB (assert_can + RLS) is still the real gate. Keep the two in sync.
// Which org's rows you may write is RLS's job, so "execute" here is only the role check.
export type permission = "author" | "archive" | "sync" | "run_iteration" | "issue_sign_off" | "sign_off" | "submit" | "execute" | "view_all_results" | "admin_area";

type role = currentUser["role"];

export const PERMISSIONS: Record<permission, readonly role[]> = {
    author: ["Admin"],
    archive: ["Admin"],
    sync: ["Admin"],
    run_iteration: ["Admin", "Internal"],
    issue_sign_off: ["Admin"],
    // Acknowledging the vendor's issued sign-off, which closes the suite.
    sign_off: ["Internal"],
    submit: ["Internal", "External"],
    execute: ["Admin", "Internal", "External"],
    view_all_results: ["Admin", "Internal"],
    admin_area: ["Admin"],
};

export function can(user: currentUser | null, permission: permission): boolean {
    if (user === null) return false;
    return PERMISSIONS[permission].includes(user.role);
}

const DENIED_MESSAGES: Record<permission, string> = {
    author: "Only the vendor team can edit suites, sections and test cases.",
    archive: "Only the vendor team can archive a suite.",
    sync: "Only the vendor team can sync test case changes into a round.",
    run_iteration: "You can't start or manage testing rounds.",
    issue_sign_off: "Only the vendor team can issue a sign-off.",
    sign_off: "Only the client team can acknowledge a sign-off.",
    submit: "Only testing organizations submit their results.",
    execute: "You can't record results.",
    view_all_results: "You can only see your own organization's results.",
    admin_area: "Only the vendor team can manage users and organizations.",
};

// Same shape as actionResult's failure branch, so actions can `return denied("author")`.
export function denied(permission: permission): { ok: false; error: string } {
    return { ok: false, error: DENIED_MESSAGES[permission] };
}
