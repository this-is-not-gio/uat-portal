"use client"

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { BATCHES } from "@/components/dashboard/testing-timeline";

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDay = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };

// The full Sunday-to-Saturday week the batch falls in, so the weekend sits on both ends.
function weekDays(start: string) {
	const first = parseDay(start);
	first.setDate(first.getDate() - first.getDay());
	return Array.from({ length: 7 }, (_, offset) => { const day = new Date(first); day.setDate(first.getDate() + offset); return day; });
}

// Weekends and days outside the batch's dates aren't testing days.
const isTestingDay = (day: Date, batch: { start: string; end: string }) => day.getDay() !== 0 && day.getDay() !== 6 && dayKey(day) >= batch.start && dayKey(day) <= batch.end;

// What every testing week looks like, by weekday (Date.getDay(): 1 = Monday).
const DAY_PLAN: Record<number, { mode: "Onsite" | "Remote"; focus: string; output: string }> = {
	1: { mode: "Onsite", focus: "Knowledge Transfer, Live demos, Account handover and Login check", output: "Attendance sheet; verified accounts" },
	2: { mode: "Remote", focus: "Main happy-path scenarios", output: "Executed scripts; logged defects" },
	3: { mode: "Remote", focus: "Main scenarios and edge cases", output: "Executed scripts; logged defects" },
	4: { mode: "Remote", focus: "Exception and negative scenarios; defect cutoff 12:00 NN", output: "Fixes deployed after 5:00 PM" },
	5: { mode: "Remote", focus: "Retest by 2:00 PM; virtual acceptance review at 3:00 PM", output: "Batch acknowledgement" },
};

// Today in the viewer's timezone: null on the server, then re-checked every minute so the active day rolls over at midnight.
const subscribeToClock = (onChange: () => void) => { const timer = setInterval(onChange, 60_000); return () => clearInterval(timer); };
// Dev-only preview: /dashboard?today=2026-10-21 pretends it is that day. Remove once the design is settled.
const getToday = () => {
	const override = process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("today") : null;
	return override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : dayKey(new Date());
};
const getServerToday = () => null;
export const useToday = () => useSyncExternalStore(subscribeToClock, getToday, getServerToday);

// The batch to open on: the one running today, else the next one, else the last one.
export function currentBatchIndex(today: string | null) {
	if (!today) return 0;
	const running = BATCHES.findIndex((batch) => today >= batch.start && today <= batch.end);
	if (running !== -1) return running;
	const upcoming = BATCHES.findIndex((batch) => today < batch.start);
	return upcoming !== -1 ? upcoming : BATCHES.length - 1;
}

// One week of the testing schedule, a day at a time. Today is the active day and opens its details.
export function TestingCalendar({ batchIndex, today, id, labelledBy }: { batchIndex: number; today: string | null; id: string; labelledBy: string }) {
	const batch = BATCHES[batchIndex];
	const days = weekDays(batch.start);

	return (
		<div id={id} role="tabpanel" aria-labelledby={labelledBy} className="flex flex-col gap-3 border-t border-gray-600/50 p-4">

			<ol className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,0.5fr)_repeat(5,minmax(0,1fr))_minmax(0,0.5fr)]">
				{days.map((day) => {
					const key = dayKey(day);
					const state = !isTestingDay(day, batch) ? "off" : today === null ? "upcoming" : key === today ? "active" : key < today ? "past" : "upcoming";
					const plan = DAY_PLAN[day.getDay()];
					return (
						<li
							key={key}
							aria-current={state === "active" ? "date" : undefined}
							aria-disabled={state === "off" || undefined}
							className={cn(
								"flex flex-col gap-3 rounded-md border p-3 transition-colors",
								state === "active" && "border-blue-600 bg-blue-50 text-blue-700 shadow-sm",
								state === "off" && "cursor-not-allowed border-dashed border-gray-600/20 bg-muted/40 text-muted-foreground/60",
								state === "past" && "border-gray-600/20 text-muted-foreground opacity-60",
								state === "upcoming" && "border-gray-600/40",
							)}
						>
							<div className="flex flex-row items-center justify-between gap-2">
								<div className="flex items-baseline justify-between gap-2 lg:flex-col lg:items-start lg:justify-start lg:gap-0">
									<span className="text-xs font-medium uppercase">{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
									<span className="font-mono text-2xl font-bold tabular-nums">{day.getDate()}</span>
								</div>
								<div className="flex flex-row items-center gap-2">
									{state === "active" && (
										<span className="flex items-center gap-1.5 text-[10px] font-medium uppercase">
										Today
											<span className="relative flex size-2">
												<span className="absolute inline-flex size-full rounded-full bg-blue-600 opacity-75 motion-safe:animate-ping" />
												<span className="relative inline-flex size-2 rounded-full bg-blue-600" />
											</span>
										</span>
									)}
									{state !== "off" && plan && (
										<span className={cn("w-fit rounded-md border px-1.5 py-0.5 text-xs font-medium", plan.mode === "Onsite" ? "border-orange-600/40 bg-orange-50 text-orange-700" : "border-blue-600/40 bg-blue-50 text-blue-700")}>
											{plan.mode}
										</span>
									)}
								</div>

							</div>
							{state !== "off" && plan && (
								<div className="flex flex-1 flex-col gap-3 text-xs">

									<p className="font-medium text-foreground">{plan.focus}</p>
									<div className="mt-auto border-t border-gray-600/30 pt-2">
										<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Output</p>
										<p>{plan.output}</p>
									</div>
								</div>
							)}
						</li>
					);
				})}
			</ol>
		</div>
	);
}
