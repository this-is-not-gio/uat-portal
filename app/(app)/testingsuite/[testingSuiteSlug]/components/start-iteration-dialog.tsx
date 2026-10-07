"use client";

import { useState, useTransition } from "react";
import { CalendarIcon, Play, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { startIteration } from "@/lib/supabase/iteration-actions";

// Plans the next test round as an empty, not-started iteration. Participants and
// sections are added on the round's own page; a blank name falls back to
// Untitled_Iteration_{n} (start_iteration, 0027).
export default function StartIterationDialog({
	suiteId,
	trigger,
}: {
	suiteId: string;
	trigger?: React.ReactElement;
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [plannedEndDate, setPlannedEndDate] = useState("");
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	// Parsed as local time (not UTC) so the picker shows the same day that was typed/selected.
	const plannedEndDateValue = plannedEndDate ? new Date(`${plannedEndDate}T00:00:00`) : undefined;

	function onStart() {
		setError(null);
		startTransition(async () => {
			const result = await startIteration({ suiteId, name: name.trim(), plannedEndDate });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
			setName("");
			setPlannedEndDate("");
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
			<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Play className="size-4" />
						Start a new test iteration
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Name the round and set its planned end date. Participants and sections are added on the iteration page before testing begins. Only one round can run at a time.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					<div className="flex flex-col gap-1">
						<Label htmlFor="iteration-name" className="text-xs text-muted-foreground flex flex-row justify-between">
							<span>Name</span>
							<span className="text-muted-foreground text-xs">(optional)</span>
						</Label>
						<Input
							id="iteration-name"
							placeholder="Untitled_Iteration"
							value={name}
							onChange={(event) => setName(event.target.value)}
							disabled={isPending}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="iteration-end" className="text-xs text-muted-foreground flex flex-row justify-between">
							<span>Planned end date</span>
							<span className="text-muted-foreground text-xs">(optional)</span>
						</Label>
						<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
							<PopoverTrigger
								render={
									<Button
										id="iteration-end"
										variant="outline"
										disabled={isPending}
										className={cn("w-full justify-start font-normal", !plannedEndDateValue && "text-muted-foreground")}
									>
										<CalendarIcon className="size-4" />
										{plannedEndDateValue ? format(plannedEndDateValue, "PPP") : "Pick a date"}
									</Button>
								}
							/>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={plannedEndDateValue}
									onSelect={(date) => {
										setPlannedEndDate(date ? format(date, "yyyy-MM-dd") : "");
										setDatePickerOpen(false);
									}}
									disabled={{ before: new Date() }}
								/>
							</PopoverContent>
						</Popover>
					</div>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Cancel
					</DialogClose>
					<Button onClick={onStart} disabled={isPending}>
						<Play className="size-4" />
						{isPending ? "Starting…" : "Start iteration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
