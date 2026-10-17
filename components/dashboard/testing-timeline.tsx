"use client"

import { cn } from "@/lib/utils";

// Planned testing batches, shown week by week. Static copy: update here when the schedule changes.
// start/end are inclusive local dates (YYYY-MM-DD) that drive the weekly calendar.
export const BATCHES = [
	{
		week: "Week 1",
		dates: "Oct 19–23",
		start: "2026-10-19",
		end: "2026-10-23",
		title: "Company Licensing",
		description: "The first batch of test cases focus on the company licensing workflow, from registration to approval.",
		modules: ["Company Registration and Approval", "Company Details on Finalization", "SEC Endorsement", "Certificate of Authority"],
	},
	{
		week: "Week 2",
		dates: "Oct 26–30",
		start: "2026-10-26",
		end: "2026-10-30",
		title: "Renewal and Agent",
		description: "The second batch of test cases focus on the renewal and agent management workflows.",
		modules: ["Certificate of Authority", "Company Renewal", "Agents"],
	},
	{
		week: "Week 3",
		dates: "Nov 3–6",
		start: "2026-11-03",
		end: "2026-11-06",
		title: "Agency, Admin and Others",
		description: "The third batch of test cases focus on the agency and admin workflows.",
		modules: ["Agency", "Admin Workflow"],
	},
];

// Navigation for the calendar below: one batch is always selected, and picking another swaps the week shown.
// A batch whose last day is before today is over, so it can't be opened.
const isPast = (batch: { end: string }, today: string | null) => today !== null && batch.end < today;

export function TestingTimeline({ selected, today, onSelect }: { selected: number; today: string | null; onSelect: (index: number) => void }) {
	return (
		<div role="tablist" aria-label="Testing batches" className="grid grid-cols-1 md:grid-cols-3">
			{BATCHES.map((batch, index) => {
				const isSelected = selected === index;
				const past = isPast(batch, today);
				return (
					<button
						key={batch.week}
						id={`testing-batch-${index}`}
						type="button"
						role="tab"
						aria-selected={isSelected}
						disabled={past}
						aria-controls="testing-batch-panel"
						tabIndex={isSelected ? 0 : -1}
						onClick={() => onSelect(index)}
						onKeyDown={(event) => {
							const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
							if (!step) return;
							event.preventDefault();
							let next = index;
							do next = (next + step + BATCHES.length) % BATCHES.length;
							while (isPast(BATCHES[next], today) && next !== index);
							if (next === index) return;
							onSelect(next);
							document.getElementById(`testing-batch-${next}`)?.focus();
						}}
						className={cn(
							"flex flex-col gap-2 border-b border-gray-600/40 p-4 text-left transition-colors last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 md:border-b-0 md:border-r md:last:border-r-0",
							past ? "cursor-not-allowed bg-muted/40 text-muted-foreground/60" : "cursor-pointer bg-background hover:bg-muted/60",
						)}
					>
						<div className="flex flex-row items-center justify-between gap-2">
							<h3 className="font-heading text-sm font-semibold">{batch.title}</h3>
							<p className="text-xs font-medium font-mono uppercase tracking-wide text-muted-foreground">
								{batch.week} · {batch.dates}
							</p>
						</div>
						<p className="text-xs text-muted-foreground">{batch.description}</p>
					</button>
				);
			})}
		</div>
	);
}
