// The bar a sign-off report's verdict is measured against. Pure and client-safe:
// the suite dialog validates with it before saving, the server action re-checks.

export type ExitCriteria = {
    minPassRate: number;
    maxFailed: number;
    maxBlocked: number;
    requireAllOrgsSubmitted: boolean;
};

// Same as the column default in 0044.
export const DEFAULT_EXIT_CRITERIA: ExitCriteria = { minPassRate: 95, maxFailed: 0, maxBlocked: 0, requireAllOrgsSubmitted: true };

export function exitCriteriaError(criteria: ExitCriteria): string | null {
    const isCount = (n: number) => Number.isInteger(n) && n >= 0;
    if (!(criteria.minPassRate >= 0 && criteria.minPassRate <= 100)) return "Minimum pass rate must be between 0 and 100.";
    if (!isCount(criteria.maxFailed) || !isCount(criteria.maxBlocked)) return "Maximums must be whole numbers, 0 or more.";
    return null;
}

export function sameExitCriteria(a: ExitCriteria, b: ExitCriteria): boolean {
    return a.minPassRate === b.minPassRate && a.maxFailed === b.maxFailed && a.maxBlocked === b.maxBlocked && a.requireAllOrgsSubmitted === b.requireAllOrgsSubmitted;
}

// testing_suites.exit_criteria jsonb -> ExitCriteria; missing keys fall back to the defaults.
export function toExitCriteria(raw: unknown): ExitCriteria {
    const r = (raw ?? {}) as Partial<ExitCriteria>;
    return {
        minPassRate: typeof r.minPassRate === "number" ? r.minPassRate : DEFAULT_EXIT_CRITERIA.minPassRate,
        maxFailed: typeof r.maxFailed === "number" ? r.maxFailed : DEFAULT_EXIT_CRITERIA.maxFailed,
        maxBlocked: typeof r.maxBlocked === "number" ? r.maxBlocked : DEFAULT_EXIT_CRITERIA.maxBlocked,
        requireAllOrgsSubmitted:
            typeof r.requireAllOrgsSubmitted === "boolean" ? r.requireAllOrgsSubmitted : DEFAULT_EXIT_CRITERIA.requireAllOrgsSubmitted,
    };
}
