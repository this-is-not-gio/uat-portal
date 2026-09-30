import { isBefore, parseISO, startOfToday } from "date-fns";
import type { currentUser } from "@/lib/supabase/auth";
import type { SidebarSuite } from "@/lib/supabase/Init";
import {
    LucideIcon,
    PencilSparkles,
    BookOpenCheck,
    TestTubeDiagonalIcon,
    Signature,
    Archive,
    CircleCheckBig,
} from "lucide-react";

// Pure sidebar rules: nav-secondary.tsx only renders what these return.

type role = currentUser["role"];

export type suiteGroup = {
    label: string;
    suites: SidebarSuite[];
    icon?: LucideIcon;
    collapsible?: boolean;
};

export type badgeTone = "default" | "active" | "muted" | "danger" | "success";
export type suiteBadgeInfo = { text: string; tone: badgeTone };

// TODO(you) #2: split the suites into sidebar groups for this role, dropping empty groups.
// Admin: one group per lifecycle status, in lifecycle order; Archived collapsible.
// Internal: In Testing / Signed off / Archived (collapsible).
// External: Testing now (openRound && mine.inOpenRound) / Finished (the rest).
export function groupSuites(role: role, suites: SidebarSuite[]): suiteGroup[] {
    const nonEmptyGroups = (groups: suiteGroup[]) =>
        groups.filter((g) => g.suites.length > 0);

    switch (role) {
        case "Admin":
            return nonEmptyGroups([
                {
                    label: "Drafts",
                    suites: suites.filter((s) => s.status === "draft"),
                    icon: PencilSparkles,
                },
                {
                    label: "Ready to Test",
                    suites: suites.filter((s) => s.status === "ready"),
                    icon: BookOpenCheck,
                },
                {
                    label: "In Testing",
                    suites: suites.filter((s) => s.status === "in_testing"),
                    icon: TestTubeDiagonalIcon,
                },
                {
                    // Issued by the vendor, waiting for the client's acknowledgement.
                    label: "For Sign-off",
                    suites: suites.filter((s) => s.status === "sign_off_issued"),
                    icon: Signature,
                },
                {
                    label: "Signed Off",
                    suites: suites.filter((s) => s.status === "signed_off"),
                    icon: Signature,
                },
                {
                    label: "Archived",
                    suites: suites.filter((s) => s.status === "archived"),
                    collapsible: true,
                    icon: Archive,
                },
            ]);
        case "Internal":
            return nonEmptyGroups([
                {
                    label: "Test Suites",
                    suites: suites.filter(
                        (s) => s.openRound?.status === "in_progress",
                    ),
                },
                {
                    label: "For Sign-Offs",
                    suites: suites.filter(
                        (s) => s.status === "sign_off_issued" || (s.status === "in_testing" && !s.openRound),
                    ),
                },
                {
                    label: "Archived",
                    suites: suites.filter((s) => s.status === "archived"),
                    collapsible: true,
                },
            ]);
        case "External":
            return nonEmptyGroups([
                {
                    label: "Test Suites",
                    suites: suites.filter(
                        (s) => s.openRound?.status === "in_progress",
                    ),
                },
                {
                    label: "For Sign-Offs",
                    suites: suites.filter(
                        (s) => s.status === "sign_off_issued" || (s.status === "in_testing" && !s.openRound),
                    ),
                },
                {
                    label: "Archived",
                    suites: suites.filter((s) => s.status === "archived"),
                    collapsible: true,
                },
            ]);
        default:
            return [];
    }
}
