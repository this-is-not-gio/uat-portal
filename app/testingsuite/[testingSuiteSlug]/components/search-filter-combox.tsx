	"use client"

	import {
		Combobox,
		ComboboxContent,
		ComboboxEmpty,
		ComboboxInput,
		ComboboxItem,
		ComboboxList,
	} from "@/components/ui/combobox";
	import { CheckCircle2, Circle, Clock, Equal, EqualNot, ListChecks, Search, User, X, XCircle } from "lucide-react";
	import { useState, type KeyboardEvent } from "react";
	import { cn } from "@/lib/utils";

	// Reasons base-ui reports on a genuine, unambiguous user-initiated
	// dismissal (escape, clicking outside). Deliberately excludes "focus-out":
	// clicking a list item can itself cause a transient blur before the click
	// is processed as a selection, so treating blur as "abandoned" raced with
	// handleFieldSelect and resurrected a just-replaced draft. Any other
	// reason — including whatever fires when we unmount one step's Combobox to
	// mount the next one, since they share one `open` state variable — is
	// ignored too, or every step transition would spuriously look like an
	// abandon-and-close.
	const USER_DISMISS_REASONS = new Set(["escape-key", "outside-press"]);

	export type filterField = "status" | "roleAssignee"
	export type filterOperator = "is" | "is not"
	export type filterToken =
		| { id: string; field: filterField; operator: filterOperator; value: string }
		| { id: string; field: "search"; value: string };

	const STATUS_VALUES = ["Untested", "In Progress", "Passed", "Failed"];

	const COMBOBOX_INPUT_CLASSNAME =
		"w-full border-0 shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 **:data-[slot=input-group-control]:p-0 **:data-[slot=input-group-control]:text-xs";

	export function SearchFilterCombobox({
		filters,
		onFiltersChange,
		roleAssigneeValues,
		disabled = false,
	}: {
		filters: filterToken[];
		onFiltersChange: (filters: filterToken[]) => void;
		roleAssigneeValues: string[];
		disabled?: boolean;
	}) {
		const [step, setStep] = useState<"field" | "operator" | "value">("field");
		const [draftField, setDraftField] = useState<filterField | null>(null);
		const [draftOperator, setDraftOperator] = useState<filterOperator | null>(null);
		const [draftValue, setDraftValue] = useState<string | null>(null);
		const [inputValue, setInputValue] = useState<string>("");
		const [open, setOpen] = useState<boolean>(false);
		// The field-step Combobox is the only one ever mounted before any user
		// interaction (on initial page load). Its `autoFocus` was firing on that
		// very first mount too, auto-opening the popup before you'd touched
		// anything. Gate `autoFocus` behind this so the very first render skips
		// it, while every later step-transition (which only ever happens because
		// you already interacted) still gets it.
		const [hasInteracted, setHasInteracted] = useState<boolean>(false);

		const usedFields = new Set(filters.map((f) => f.field));
		const FIELD_OPTIONS = ["Status", "Role Assignee"].filter(
			(label) => !usedFields.has(label === "Status" ? "status" : "roleAssignee")
		);
		const OPERATOR_OPTIONS = ["is", "is not"];
		const VALUE_OPTIONS = draftField === "status" ? STATUS_VALUES : roleAssigneeValues;

		function hasNoMatch(options: string[]): boolean {
			const term = inputValue.trim().toLowerCase();
			return term !== "" && !options.some((o) => o.toLowerCase().includes(term));
		}

		function resetDraft() {
			setDraftField(null);
			setDraftOperator(null);
			setDraftValue(null);
			setInputValue("");
			setStep("field");
		}

		function handleFieldSelect(selected: string | null) {
			if (!selected) return;
			setDraftField(selected === "Status" ? "status" : "roleAssignee");
			setDraftValue(null); // starting a brand-new filter, nothing to retain
			setInputValue("");
			setStep("operator");
			setOpen(true);
		}

		function handleOperatorSelect(selected: string | null) {
			if (!selected) return;
			setDraftOperator(selected as filterOperator);
			setInputValue("");
			setStep("value");
			setOpen(true);
		}

		function handleValueSelect(selected: string | null) {
			if (!selected || !draftField || !draftOperator) return;
			onFiltersChange([...filters, { id: crypto.randomUUID(), field: draftField, operator: draftOperator, value: selected }]);
			resetDraft();
		}

		// Free-text fallback: whenever a step's typed text doesn't match any of
		// its options, offer to search test case titles for that text directly,
		// bypassing field/operator/value entirely.
		function handleSearchInstead() {
			const term = inputValue.trim();
			if (!term) return;
			onFiltersChange([...filters, { id: crypto.randomUUID(), field: "search", value: term }]);
			resetDraft();
			setOpen(false);
		}

		// Fires whenever any step's popup opens or closes — including spurious
		// calls from unmounting one step's Combobox to mount the next (they
		// share the `open` state). Only act on a genuine user-initiated
		// dismissal (escape / outside click), and only restore the full 3-part
		// filter case (never the reopened search term — that one proved racy
		// against handleFieldSelect and caused duplicate chips; abandoning a
		// reopened search term now just discards it instead of auto-restoring).
		function handleOpenChange(nextOpen: boolean, eventDetails: { reason: string }) {
			setOpen(nextOpen);
			if (nextOpen || !USER_DISMISS_REASONS.has(eventDetails.reason)) return;
			if (step === "value" && draftField && draftOperator && draftValue) {
				onFiltersChange([...filters, { id: crypto.randomUUID(), field: draftField, operator: draftOperator, value: draftValue }]);
			}
			resetDraft();
		}

		function fieldLabel(field: filterField | "search"): string {
			if (field === "status") return "Status";
			if (field === "roleAssignee") return "Role Assignee";
			return "Search";
		}

		function fieldOptionIcon(label: string) {
			return label === "Status" ? <ListChecks size={14} /> : <User size={14} />;
		}

		function operatorOptionIcon(label: string) {
			return label === "is" ? <Equal size={14} /> : <EqualNot size={14} />;
		}

		function valueOptionIcon(label: string) {
			if (draftField === "status") {
				if (label === "Untested") return <Circle size={14} />;
				if (label === "In Progress") return <Clock size={14} />;
				if (label === "Passed") return <CheckCircle2 size={14} />;
				if (label === "Failed") return <XCircle size={14} />;
			}
			return <User size={14} />;
		}

		// Backspace on an empty step-input always reopens the nearest thing for
		// editing rather than deleting outright: at the field step (nothing
		// drafted yet) it pops the last completed filter back into the value
		// step, so its field/operator stay as chips and only the value is
		// re-picked.
		function handleFieldKeyDown(e: KeyboardEvent<HTMLInputElement>) {
			if (e.key === "Enter" && hasNoMatch(FIELD_OPTIONS)) {
				e.preventDefault();
				handleSearchInstead();
				return;
			}
			if (e.key === "Backspace" && e.currentTarget.value === "" && filters.length > 0) {
				const last = filters[filters.length - 1];
				onFiltersChange(filters.slice(0, -1));
				if (last.field === "search") {
					// a search chip has no field/operator/value steps to re-enter — just drop it
					return;
				}
				setDraftField(last.field);
				setDraftOperator(last.operator);
				setDraftValue(last.value); // preselect the value it had before, ready to keep or change
				setStep("value");
				setOpen(true);
			}
		}

		function handleOperatorKeyDown(e: KeyboardEvent<HTMLInputElement>) {
			if (e.key === "Backspace" && e.currentTarget.value === "") {
				// keep draftField as-is so the reopened field combobox preselects it
				setStep("field");
				setOpen(true);
			}
		}

		function handleValueKeyDown(e: KeyboardEvent<HTMLInputElement>) {
			if (e.key === "Enter" && hasNoMatch(VALUE_OPTIONS)) {
				e.preventDefault();
				handleSearchInstead();
				return;
			}
			if (e.key === "Backspace" && e.currentTarget.value === "") {
				setDraftOperator(null);
				setStep("operator");
			}
		}

		function searchFallback(placeholderText: string) {
			const term = inputValue.trim();
			return (
				<ComboboxEmpty>
					{term ? (
						<button
							type="button"
							className="w-full text-left text-xs px-2 py-1.5 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700"
							onClick={handleSearchInstead}
						>
							Search &quot;{term}&quot; instead
						</button>
					) : (
						<span className="text-xs px-2 py-1.5 block text-muted-foreground">{placeholderText}</span>
					)}
				</ComboboxEmpty>
			);
		}

		return (
			<div className={cn("border flex flex-row rounded-md border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 w-full items-center px-2 gap-1", disabled && "opacity-50 pointer-events-none bg-gray-300/60")}>
				{filters.map((filter) => (
					<div key={filter.id} className="flex flex-row gap-0.5 shrink-0">
						{filter.field === "search" ? (
							<span className="w-full whitespace-nowrap flex items-center gap-1 py-1 px-2 bg-slate-200 dark:bg-slate-700 rounded-md h-fit text-xs">
								Search: &quot;{filter.value}&quot;
								<button type="button" onClick={() => onFiltersChange(filters.filter((f) => f.id !== filter.id))}>
									<X size={12} />
								</button>
							</span>
						) : (
							<>
								<span className="flex items-center gap-1 py-1 px-2 bg-slate-200 dark:bg-slate-700 rounded-tl-md rounded-bl-md h-fit text-xs">
									{fieldLabel(filter.field)}
								</span>
								<span className="flex items-center gap-1 py-1 px-2 bg-slate-200 dark:bg-slate-700 text-xs h-fit">
									{filter.operator}
								</span>
								<span className="flex items-center gap-1 py-1 px-2 bg-slate-200 dark:bg-slate-700 rounded-tr-md rounded-br-md h-fit text-xs">
									{filter.value}
									<button type="button" onClick={() => onFiltersChange(filters.filter((f) => f.id !== filter.id))}>
										<X size={12} />
									</button>
								</span>
							</>
						)}
					</div>
				))}
				<div className="flex flex-row gap-0.5 shrink-0">
					{draftField && step !== "field" && (
						<span className="flex items-center gap-1 py-1 px-2 bg-slate-200 dark:bg-slate-700 rounded-tl-md rounded-bl-md text-xs h-fit">
							{fieldLabel(draftField)}
						</span>
					)}
					{draftOperator && step !== "operator" && (
						<span className="flex items-center gap-1 py-1 px-2 bg-slate-200 dark:bg-slate-700 text-xs h-fit">
							{draftOperator}
						</span>
					)}
				</div>

				<div className="flex-1 min-w-0">
					{step === "field" && (
						<Combobox key={draftField ?? "field-empty"} items={FIELD_OPTIONS} defaultValue={draftField ? fieldLabel(draftField) : null} onValueChange={handleFieldSelect} onInputValueChange={setInputValue} open={open} onOpenChange={handleOpenChange}>
							<ComboboxInput
								autoFocus={hasInteracted}
								showTrigger={false}
								disabled={disabled}
								onFocus={() => { setHasInteracted(true); setOpen(true); }}
								onKeyDown={handleFieldKeyDown}
								placeholder={filters.length === 0 ? "Filter test cases..." : ""}
								className={COMBOBOX_INPUT_CLASSNAME}
							/>
							<ComboboxContent className="w-fit min-w-0">
								{searchFallback(
									FIELD_OPTIONS.length === 0
										? "Status and Role Assignee are both already filtered — type to search test case titles instead."
										: "No items found."
								)}
								<ComboboxList>
									{(item) => (
										<ComboboxItem className="text-xs gap-1.5" key={item} value={item}>
											{fieldOptionIcon(item)}
											{item}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					)}
					{step === "operator" && (
						<Combobox items={OPERATOR_OPTIONS} onValueChange={handleOperatorSelect} open={open} onOpenChange={handleOpenChange}>
							<ComboboxInput
								autoFocus={hasInteracted}
								showTrigger={false}
								disabled={disabled}
								onFocus={() => { setHasInteracted(true); setOpen(true); }}
								onKeyDown={handleOperatorKeyDown}
								placeholder=""
								className={COMBOBOX_INPUT_CLASSNAME}
							/>
							<ComboboxContent className="w-fit min-w-0">
								<ComboboxEmpty>No items found.</ComboboxEmpty>
								<ComboboxList>
									{(item) => (
										<ComboboxItem className="text-xs gap-1.5" key={item} value={item}>
											{operatorOptionIcon(item)}
											{item}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					)}
					{step === "value" && (
						<Combobox key={draftValue ?? "value-empty"} items={VALUE_OPTIONS} defaultValue={draftValue} onValueChange={handleValueSelect} onInputValueChange={setInputValue} open={open} onOpenChange={handleOpenChange}>
							<ComboboxInput
								autoFocus={hasInteracted}
								showTrigger={false}
								disabled={disabled}
								onFocus={() => { setHasInteracted(true); setOpen(true); }}
								onKeyDown={handleValueKeyDown}
								placeholder=""
								className={COMBOBOX_INPUT_CLASSNAME}
							/>
							<ComboboxContent className="w-fit min-w-0">
								{searchFallback("No items found.")}
								<ComboboxList>
									{(item) => (
										<ComboboxItem className="text-xs gap-1.5" key={item} value={item}>
											{valueOptionIcon(item)}
											{item}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					)}
				</div>

				{filters.length > 0 ? (
					<button
						type="button"
						className="shrink-0 flex items-center gap-1 py-1 px-2 rounded-md text-xs text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
						onClick={() => {
							onFiltersChange([]);
							resetDraft();
						}}
					>
						Clear all
						<X size={12} />
					</button>
				) : (
					<Search size={14} className="shrink-0 text-muted-foreground" />
				)}
			</div>
		)
	}
