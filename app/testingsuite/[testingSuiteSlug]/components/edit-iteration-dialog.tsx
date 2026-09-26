"use client";

import { useState, useTransition } from "react";
import { CalendarIcon, Pencil, X } from "lucide-react";
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
import { updateIterationDetails } from "@/lib/supabase/iteration-actions";
import type { testIteration } from "@/lib/supabase/test-iterations";

// Edits an iteration's label/planned end date — its name and slug (what the
// URL and iteration numbering depend on) are never touched here, unlike a
// section's rename (which does regenerate its slug).
export default function EditIterationDialog({
	iteration,
	trigger,
	open: controlledOpen,
	onOpenChange,
}: {
	iteration: testIteration;
	trigger?: React.ReactElement;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [label, setLabel] = useState(iteration.label ?? "");
	const [plannedEndDate, setPlannedEndDate] = useState(iteration.plannedEndDate ?? "");
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const plannedEndDateValue = plannedEndDate ? new Date(`${plannedEndDate}T00:00:00`) : undefined;

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await updateIterationDetails({ iterationId: iteration.id, label: label.trim(), plannedEndDate });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setLabel(iteration.label ?? "");
					setPlannedEndDate(iteration.plannedEndDate ?? "");
				}
				setError(null);
			}}
		>
			{trigger && <DialogTrigger render={trigger} />}
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Pencil className="size-4" />
						Edit {iteration.name}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						The label and planned end date are the only things you can change here — renaming would break the round&apos;s existing links.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					<div className="flex flex-col gap-1">
						<Label htmlFor="edit-iteration-label" className="text-xs text-muted-foreground flex flex-row justify-between">
							<span>Label</span>
							<span className="text-muted-foreground text-xs">(optional)</span>
						</Label>
						<Input
							id="edit-iteration-label"
							placeholder="e.g. Post-fix retest"
							value={label}
							onChange={(event) => setLabel(event.target.value)}
							disabled={isPending}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor="edit-iteration-end" className="text-xs text-muted-foreground flex flex-row justify-between">
							<span>Planned end date</span>
							<span className="text-muted-foreground text-xs">(optional)</span>
						</Label>
						<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
							<PopoverTrigger
								render={
									<Button
										id="edit-iteration-end"
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
					<Button onClick={onSave} disabled={isPending}>
						<Pencil className="size-4" />
						{isPending ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
