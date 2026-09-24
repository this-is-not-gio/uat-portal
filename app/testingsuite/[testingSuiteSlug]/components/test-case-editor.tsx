"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, BadgeCheckIcon, ClipboardCheckIcon, ListChecksIcon, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Constants } from "@/lib/supabase/database.types";
import { saveTestCase, type testCaseDraft } from "@/lib/supabase/authoring-actions";
import type { testCase } from "@/lib/supabase/test-cases";

type priority = testCaseDraft["priority"];
type roleAssignee = NonNullable<testCaseDraft["roleAssignee"]>;

// `key` is only for React; `id` is the DB id of an existing item (kept on save
// so iteration snapshots stay linked to it).
type draftExpected = { key: string; id?: string; result: string };
type draftStep = { key: string; id?: string; step: string; expectedResults: draftExpected[] };
type draftPrecondition = { key: string; id?: string; condition: string };

const newKey = () => crypto.randomUUID();
const emptyStep = (): draftStep => ({ key: newKey(), step: "", expectedResults: [{ key: newKey(), result: "" }] });

function moveItem<T>(items: T[], index: number, offset: -1 | 1): T[] {
	const next = [...items];
	[next[index], next[index + offset]] = [next[index + offset], next[index]];
	return next;
}

function fromTestCase(testCase?: testCase) {
	return {
		title: testCase?.title ?? "",
		description: testCase?.description ?? "",
		priority: (testCase?.priority ?? "medium") as priority,
		roleAssignee: (testCase?.roleAssignee ?? null) as roleAssignee | null,
		preconditions: (testCase?.preconditions ?? []).map((p): draftPrecondition => ({ key: newKey(), id: p.id, condition: p.condition })),
		steps: testCase?.stepsToExecute?.length
			? testCase.stepsToExecute.map((s): draftStep => ({
				key: newKey(),
				id: s.id,
				step: s.step,
				expectedResults: s.expectedResults.map((e) => ({ key: newKey(), id: e.id, result: e.result })),
			}))
			: [emptyStep()],
	};
}

// Create / edit a live test case with its preconditions, steps and expected
// results, saved atomically by save_test_case.
export default function TestCaseEditor({
	sections,
	defaultSectionId,
	testCase,
	trigger,
}: {
	sections: { id: string; name: string }[];
	defaultSectionId?: string;
	testCase?: testCase;
	trigger: React.ReactElement;
}) {
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(() => fromTestCase(testCase));
	const [sectionId, setSectionId] = useState(testCase?.sectionId ?? defaultSectionId ?? sections[0]?.id ?? "");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const isEdit = !!testCase;

	function reset() {
		setForm(fromTestCase(testCase));
		setSectionId(testCase?.sectionId ?? defaultSectionId ?? sections[0]?.id ?? "");
		setError(null);
	}

	function updateStep(index: number, patch: Partial<draftStep>) {
		setForm((f) => ({ ...f, steps: f.steps.map((s, i) => i === index ? { ...s, ...patch } : s) }));
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await saveTestCase({
				id: testCase?.id,
				sectionId,
				title: form.title.trim(),
				description: form.description,
				priority: form.priority,
				roleAssignee: form.roleAssignee,
				preconditions: form.preconditions
					.filter((p) => p.condition.trim())
					.map(({ id, condition }) => ({ id, condition: condition.trim() })),
				steps: form.steps.map(({ id, step, expectedResults }) => ({
					id,
					step: step.trim(),
					expectedResults: expectedResults
						.filter((e) => e.result.trim())
						.map((e) => ({ id: e.id, result: e.result.trim() })),
				})),
			});
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	const canSave = !!form.title.trim() && !!sectionId && form.steps.every((s) => s.step.trim());

	return (
		<Sheet open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(); }}>
			<SheetTrigger render={trigger} />
			<SheetContent className="overflow-y-auto data-[side=right]:w-[50vw] data-[side=right]:sm:max-w-[50vw]">
				<SheetHeader className="px-8 pt-10">
					<SheetDescription className="text-xs text-muted-foreground">
						{isEdit ? testCase.code : "Code is generated on save"}
					</SheetDescription>
					<SheetTitle className="text-xl font-bold">{isEdit ? "Edit test case" : "New test case"}</SheetTitle>
				</SheetHeader>

				<div className="px-8 flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="tc-title">Title</Label>
						<Input id="tc-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} disabled={isPending} />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="tc-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
						<Textarea id="tc-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} disabled={isPending} />
					</div>
					<div className="grid grid-cols-3 gap-3">
						<div className="flex flex-col gap-2">
							<Label>Section</Label>
							<Select value={sectionId} onValueChange={(value) => value && setSectionId(value)} disabled={isPending}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select a section">{sections.find((s) => s.id === sectionId)?.name}</SelectValue>
								</SelectTrigger>
								<SelectContent alignItemWithTrigger={false}>
									{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Priority</Label>
							<Select value={form.priority} onValueChange={(value) => value && setForm((f) => ({ ...f, priority: value as priority }))} disabled={isPending}>
								<SelectTrigger className="w-full capitalize"><SelectValue>{form.priority}</SelectValue></SelectTrigger>
								<SelectContent alignItemWithTrigger={false}>
									{Constants.public.Enums.priority_level.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Role assignee</Label>
							<Select value={form.roleAssignee ?? ""} onValueChange={(value) => setForm((f) => ({ ...f, roleAssignee: (value || null) as roleAssignee | null }))} disabled={isPending}>
								<SelectTrigger className="w-full"><SelectValue placeholder="None">{form.roleAssignee ?? "None"}</SelectValue></SelectTrigger>
								<SelectContent alignItemWithTrigger={false}>
									<SelectItem value="">None</SelectItem>
									{Constants.public.Enums.role_assignee_type.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* Preconditions */}
				<div className="px-8 flex flex-col gap-3">
					<div className="flex flex-row items-center gap-2">
						<div className="flex flex-col items-center justify-center size-10 rounded-md bg-muted text-muted-foreground"><ClipboardCheckIcon className="size-5" /></div>
						<div>
							<h3 className="font-semibold">Preconditions</h3>
							<p className="text-xs text-muted-foreground">Things to have in place before running the test case.</p>
						</div>
					</div>
					{form.preconditions.map((p, index) => (
						<div key={p.key} className="flex flex-row items-center gap-2">
							<Input
								value={p.condition}
								placeholder={`Precondition ${index + 1}`}
								onChange={(e) => setForm((f) => ({ ...f, preconditions: f.preconditions.map((x, i) => i === index ? { ...x, condition: e.target.value } : x) }))}
								disabled={isPending}
							/>
							<Button variant="ghost" size="icon" disabled={isPending} onClick={() => setForm((f) => ({ ...f, preconditions: f.preconditions.filter((_, i) => i !== index) }))} aria-label="Remove precondition">
								<X className="h-4 w-4" />
							</Button>
						</div>
					))}
					<Button variant="outline" size="sm" className="w-fit" disabled={isPending} onClick={() => setForm((f) => ({ ...f, preconditions: [...f.preconditions, { key: newKey(), condition: "" }] }))}>
						<Plus className="h-3.5 w-3.5" /> Add precondition
					</Button>
				</div>

				{/* Steps */}
				<div className="px-8 flex flex-col gap-3 pb-6">
					<div className="flex flex-row items-center gap-2">
						<div className="flex flex-col items-center justify-center size-10 rounded-md bg-muted text-muted-foreground"><ListChecksIcon className="size-5" /></div>
						<div>
							<h3 className="font-semibold">Steps to Execute</h3>
							<p className="text-xs text-muted-foreground">Each step needs at least one expected result before the suite can be marked ready.</p>
						</div>
					</div>
					{form.steps.map((step, index) => (
						<div key={step.key} className="border rounded-md p-3 flex flex-col gap-3">
							<div className="flex flex-row items-center gap-2">
								<div className="size-7 shrink-0 rounded-full bg-accent flex items-center justify-center text-xs font-bold">{index + 1}</div>
								<Input value={step.step} placeholder="What the tester does" onChange={(e) => updateStep(index, { step: e.target.value })} disabled={isPending} />
								<Button variant="ghost" size="icon" disabled={isPending || index === 0} onClick={() => setForm((f) => ({ ...f, steps: moveItem(f.steps, index, -1) }))} aria-label="Move step up"><ArrowUp className="h-4 w-4" /></Button>
								<Button variant="ghost" size="icon" disabled={isPending || index === form.steps.length - 1} onClick={() => setForm((f) => ({ ...f, steps: moveItem(f.steps, index, 1) }))} aria-label="Move step down"><ArrowDown className="h-4 w-4" /></Button>
								<Button variant="ghost" size="icon" disabled={isPending || form.steps.length === 1} onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }))} aria-label="Remove step"><Trash2 className="h-4 w-4" /></Button>
							</div>
							<div className="pl-9 flex flex-col gap-2">
								<div className="flex items-center gap-1">
									<BadgeCheckIcon size={12} />
									<p className="text-xs font-medium">Expected results</p>
								</div>
								{step.expectedResults.map((expected, eIndex) => (
									<div key={expected.key} className="flex flex-row items-center gap-2">
										<Input
											value={expected.result}
											placeholder="What should happen"
											onChange={(e) => updateStep(index, { expectedResults: step.expectedResults.map((x, i) => i === eIndex ? { ...x, result: e.target.value } : x) })}
											disabled={isPending}
										/>
										<Button variant="ghost" size="icon" disabled={isPending} onClick={() => updateStep(index, { expectedResults: step.expectedResults.filter((_, i) => i !== eIndex) })} aria-label="Remove expected result">
											<X className="h-4 w-4" />
										</Button>
									</div>
								))}
								<Button variant="ghost" size="sm" className="w-fit" disabled={isPending} onClick={() => updateStep(index, { expectedResults: [...step.expectedResults, { key: newKey(), result: "" }] })}>
									<Plus className="h-3.5 w-3.5" /> Add expected result
								</Button>
							</div>
						</div>
					))}
					<Button variant="outline" size="sm" className="w-fit" disabled={isPending} onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, emptyStep()] }))}>
						<Plus className="h-3.5 w-3.5" /> Add step
					</Button>
				</div>

				<SheetFooter className="flex flex-row items-center justify-between sticky bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t p-4">
					<p className="text-xs text-destructive">{error}</p>
					<div className="flex flex-row gap-2">
						<Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>Cancel</Button>
						<Button disabled={isPending || !canSave} onClick={onSave}>
							{isPending ? "Saving…" : isEdit ? "Save changes" : "Create test case"}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
