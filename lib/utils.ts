export { cn } from "cn"

import { formatDistanceToNow, format, differenceInHours } from "date-fns";

export function humanizeTimestamp(isoString?: string): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  const hoursAgo = differenceInHours(new Date(), date);

  if (hoursAgo < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return formatTimestamp(isoString);
}

export function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return "—";
  return format(new Date(isoString), "MMM d yyyy hh:mm a");
}

export function formatIterationTimestamp(iteration: { status: string; startedAt: string; completedAt: string | null }): string {
  switch (iteration.status) {
    case "completed": return `Completed on ${formatTimestamp(iteration.completedAt)}`;
    case "stopped": return `Stopped on ${formatTimestamp(iteration.completedAt)}`;
    // started_at is the creation time until the round is started.
    case "not_started": return `Not started · planned ${formatTimestamp(iteration.startedAt)}`;
    default: return `In progress · started ${formatTimestamp(iteration.startedAt)}`;
  }
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
