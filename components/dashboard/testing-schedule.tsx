"use client"

import { useState } from "react";
import { TestingTimeline } from "@/components/dashboard/testing-timeline";
import { TestingCalendar, currentBatchIndex, useToday } from "@/components/dashboard/testing-calendar";

// The timeline works as navigation for the calendar: it opens on the current batch and shows whichever one is picked.
export function TestingSchedule() {
	const today = useToday();
	const [picked, setPicked] = useState<number | null>(null);
	const selected = picked ?? currentBatchIndex(today);

	return (
		<>
			<TestingTimeline selected={selected} today={today} onSelect={setPicked} />
			<TestingCalendar batchIndex={selected} today={today} id="testing-batch-panel" labelledBy={`testing-batch-${selected}`} />
		</>
	);
}
