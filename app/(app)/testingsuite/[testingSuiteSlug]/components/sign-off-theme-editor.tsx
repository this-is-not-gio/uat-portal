"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { groupRemarks, themeProblem, THEME_LIMITS, type ReportRemark, type ThemeInput } from "@/lib/report/sign-off-remarks";

// Optional vendor observations in the sign-off dialog. A theme is a title, an optional summary and
// one or more cited remarks. Quotes are whole remarks picked from the catalog, never typed, so they
// stay verbatim. issueSignOff re-checks every citation against a catalog rebuilt on the server.
export default function SignOffThemeEditor({
	remarks,
	themes,
	onChange,
	disabled,
}: {
	remarks: ReportRemark[];
	themes: ThemeInput[];
	onChange: (themes: ThemeInput[]) => void;
	disabled?: boolean;
}) {
	const remarksById = useMemo(() => new Map(remarks.map((r) => [r.id, r])), [remarks]);

	function update(id: string, patch: Partial<ThemeInput>) {
		onChange(themes.map((t) => (t.id === id ? { ...t, ...patch } : t)));
	}

	if (remarks.length === 0) {
		return <p className="text-sm text-muted-foreground">No tester remarks were recorded.</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs text-muted-foreground">
				Optional. Group tester remarks into observations. Every theme must cite at least one remark. Keep the wording neutral: describe what testers reported, without pass/fail opinions.
			</p>
			{themes.map((theme, i) => (
				<ThemeCard
					key={theme.id}
					index={i}
					theme={theme}
					remarks={remarks}
					remarksById={remarksById}
					disabled={disabled}
					onChange={(patch) => update(theme.id, patch)}
					onRemove={() => onChange(themes.filter((t) => t.id !== theme.id))}
				/>
			))}
			<Button
				variant="outline"
				size="sm"
				className="self-start"
				disabled={disabled || themes.length >= THEME_LIMITS.maxThemes}
				onClick={() => onChange([...themes, { id: crypto.randomUUID(), title: "", summary: "", remarkIds: [] }])}
			>
				<PlusIcon />
				Add observation
			</Button>
		</div>
	);
}

function ThemeCard({
	index,
	theme,
	remarks,
	remarksById,
	disabled,
	onChange,
	onRemove,
}: {
	index: number;
	theme: ThemeInput;
	remarks: ReportRemark[];
	remarksById: Map<string, ReportRemark>;
	disabled?: boolean;
	onChange: (patch: Partial<ThemeInput>) => void;
	onRemove: () => void;
}) {
	const [picking, setPicking] = useState(theme.remarkIds.length === 0);
	const problem = themeProblem(theme) ?? (theme.remarkIds.some((id) => !remarksById.has(id)) ? "cites a remark that no longer exists" : null);

	function toggleRemark(id: string, checked: boolean) {
		onChange({ remarkIds: checked ? [...theme.remarkIds, id] : theme.remarkIds.filter((r) => r !== id) });
	}

	return (
		<div className="flex flex-col gap-2 rounded-md border p-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs font-semibold text-muted-foreground">Observation {index + 1}</p>
				<Button variant="ghost" size="icon-sm" aria-label={`Remove observation ${index + 1}`} disabled={disabled} onClick={onRemove}>
					<Trash2Icon />
				</Button>
			</div>
			<Input
				value={theme.title}
				onChange={(e) => onChange({ title: e.target.value })}
				placeholder="Title, e.g. Session timeouts during long forms"
				maxLength={THEME_LIMITS.maxTitle}
				aria-label={`Observation ${index + 1} title`}
				disabled={disabled}
			/>
			<Textarea
				value={theme.summary}
				onChange={(e) => onChange({ summary: e.target.value })}
				placeholder="Summary (optional): what testers reported"
				maxLength={THEME_LIMITS.maxSummary}
				aria-label={`Observation ${index + 1} summary`}
				disabled={disabled}
			/>
			{theme.remarkIds.length > 0 && (
				<ul className="flex flex-wrap gap-1.5">
					{theme.remarkIds.map((id) => {
						const remark = remarksById.get(id);
						return (
							<li key={id}>
								<Badge variant="outline" className="h-auto max-w-72 gap-1 py-0.5 pr-0.5 font-normal">
									<span className="truncate">
										<span className="font-mono">{remark ? remark.code ?? remark.title : "Missing remark"}</span>
										{remark && <span className="text-muted-foreground"> “{remark.remark}”</span>}
									</span>
									<button
										type="button"
										className="rounded-sm p-0.5 hover:bg-muted disabled:opacity-50"
										aria-label="Remove cited remark"
										disabled={disabled}
										onClick={() => toggleRemark(id, false)}
									>
										<XIcon className="size-3" />
									</button>
								</Badge>
							</li>
						);
					})}
				</ul>
			)}
			{picking ? (
				<RemarkPicker remarks={remarks} selected={theme.remarkIds} disabled={disabled} onToggle={toggleRemark} onDone={() => setPicking(false)} />
			) : (
				<Button variant="outline" size="sm" className="self-start" disabled={disabled} onClick={() => setPicking(true)}>
					<PlusIcon />
					Add remarks
				</Button>
			)}
			{problem && <p className="text-xs text-amber-700">This observation {problem}.</p>}
		</div>
	);
}

function RemarkPicker({
	remarks,
	selected,
	disabled,
	onToggle,
	onDone,
}: {
	remarks: ReportRemark[];
	selected: string[];
	disabled?: boolean;
	onToggle: (id: string, checked: boolean) => void;
	onDone: () => void;
}) {
	const [query, setQuery] = useState("");
	const groups = useMemo(() => {
		const q = query.trim().toLowerCase();
		const matches = q
			? remarks.filter((r) => [r.code ?? "", r.title, r.remark].some((text) => text.toLowerCase().includes(q)))
			: remarks;
		return groupRemarks(matches);
	}, [remarks, query]);

	return (
		<div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
			<div className="relative">
				<SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Filter by case code, title or remark"
					aria-label="Filter remarks"
					className="h-8 pl-7 text-xs"
				/>
			</div>
			<div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
				{groups.length === 0 ? (
					<p className="p-2 text-xs text-muted-foreground">No remarks match.</p>
				) : (
					groups.map((group) => (
						<div key={group.section} className="flex flex-col gap-1.5">
							<p className="text-xs font-semibold">{group.section}</p>
							{group.cases.map((c) => (
								<div key={c.testCaseId} className="flex flex-col gap-1 pl-2">
									<p className="text-xs text-muted-foreground">
										{c.code && <span className="font-mono">{c.code} </span>}
										{c.title}
									</p>
									{c.remarks.map((r) => {
										const checked = selected.includes(r.id);
										return (
											<label
												key={r.id}
												className={cn("flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2", checked && "border-primary/50")}
											>
												<Checkbox className="mt-0.5" checked={checked} disabled={disabled} onCheckedChange={(next) => onToggle(r.id, next === true)} />
												<span className="flex flex-col gap-0.5 text-xs">
													<span>“{r.remark}”</span>
													<span className="text-muted-foreground">
														{r.organizationName} · {r.roundName} · Step {r.stepNumber} ({r.stepStatus})
													</span>
												</span>
											</label>
										);
									})}
								</div>
							))}
						</div>
					))
				)}
			</div>
			<Button variant="ghost" size="sm" className="self-end" onClick={onDone}>
				Done
			</Button>
		</div>
	);
}
