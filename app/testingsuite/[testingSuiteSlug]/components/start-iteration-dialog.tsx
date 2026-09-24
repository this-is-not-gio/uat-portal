"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { startIteration } from "@/lib/supabase/iteration-actions";

// Starts the next test round: snapshots every test case of the suite into a
// new iteration, then lands on it in the Test Results tab.
export default function StartIterationDialog({
	suiteId,
	testSuiteSlug,
	trigger,
}: {
	suiteId: string;
	testSuiteSlug: string;
	trigger?: React.ReactElement;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [label, setLabel] = useState("");
	const [plannedEndDate, setPlannedEndDate] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onStart() {
		setError(null);
		startTransition(async () => {
			const result = await startIteration({ suiteId, label: label.trim(), plannedEndDate });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			setLabel("");
			setPlannedEndDate("");
			router.push(`/testingsuite/${testSuiteSlug}/all?tab=test-results&iteration=${result.data.iterationNumber}`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
			<DialogTrigger
				render={trigger ?? (
					<Button className="flex flex-row items-center gap-2 w-full">
						<Play className="h-4 w-4" />
						<p className="text-xs">Start Iteration</p>
					</Button>
				)}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Start a new test iteration</DialogTitle>
					<DialogDescription>
						Every test case in this suite is copied into the new round as Untested. Only one round can run at a time.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="iteration-label">Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
						<Input
							id="iteration-label"
							placeholder="e.g. Post-fix retest"
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							disabled={isPending}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="iteration-end">Planned end date <span className="text-muted-foreground font-normal">(optional)</span></Label>
						<Input
							id="iteration-end"
							type="date"
							value={plannedEndDate}
							onChange={(event) => setPlannedEndDate(event.target.value)}
							disabled={isPending}
						/>
					</div>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
					<Button onClick={onStart} disabled={isPending}>
						<Play className="h-4 w-4" />
						{isPending ? "Starting…" : "Start iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
