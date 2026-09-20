export { cn } from "cn"

import { formatDistanceToNow, format, differenceInHours } from "date-fns";

export function humanizeTimestamp(isoString?: string): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  const hoursAgo = differenceInHours(new Date(), date);

  if (hoursAgo < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return format(date, "MMM d yyyy hh:mm a");
}
