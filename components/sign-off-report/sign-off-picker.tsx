"use client";

import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTimestamp } from "@/lib/utils";
import type { signOff } from "@/lib/supabase/overview";
import { SIGN_OFF_PILL, signOffStatusOf } from "@/components/testsuite-layout/sign-off/sign-off-status-badge";

// Sign-off tab: switches between the suite's report versions (earlier and withdrawn ones included).
// signOffs is newest first, so the oldest is Version 1. The vendor's draft sits on top while open.
const DRAFT = "draft";

export function SignOffPicker({ suiteSlug, signOffs, selectedId, hasDraft = false }: { suiteSlug: string; signOffs: signOff[]; selectedId: string | null; hasDraft?: boolean }) {
	const router = useRouter();
	const versionOf = (index: number) => signOffs.length - index;
	const selectedIndex = signOffs.findIndex((s) => s.id === selectedId);
	const value = selectedId ?? DRAFT;

	return (
		<Select
			value={value}
			onValueChange={(id) => {
				if (!id || id === value) return;
				router.replace(id === DRAFT ? `/testsuite/${suiteSlug}/sign-off` : `/testsuite/${suiteSlug}/sign-off?signOff=${id}`);
			}}
		>
			<SelectTrigger className="w-full text-xs">
				<SelectValue>
					{selectedIndex >= 0 ? <VersionLabel version={versionOf(selectedIndex)} signOff={signOffs[selectedIndex]} /> : <DraftLabel />}
				</SelectValue>
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false} className="min-w-0">
				{hasDraft && (
					<SelectItem value={DRAFT}>
						<VersionOption title={<DraftLabel />} detail="Not issued yet" />
					</SelectItem>
				)}
				{signOffs.map((s, i) => (
					<SelectItem key={s.id} value={s.id}>
						<VersionOption title={<VersionLabel version={versionOf(i)} signOff={s} />} detail={`${s.iterationName} · ${formatTimestamp(s.signedOffAt)}`} />
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function VersionLabel({ version, signOff }: { version: number; signOff: signOff }) {
	const pill = SIGN_OFF_PILL[signOffStatusOf(signOff)];
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className={cn("size-1.5 shrink-0 rounded-full", pill.dot)} />
			<span className="font-medium">Version {version}</span>
			<span className="truncate text-muted-foreground text-xs">{pill.label.replace(/^Sign-off /, "")}</span>
		</span>
	);
}

function DraftLabel() {
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<span className={cn("size-1.5 shrink-0 rounded-full", SIGN_OFF_PILL.drafting.dot)} />
			<span className="font-medium">Draft</span>
		</span>
	);
}

function VersionOption({ title, detail }: { title: React.ReactNode; detail: string }) {
	return (
		<span className="flex min-w-0 flex-col gap-0.5 py-0.5">
			{title}
		</span>
	);
}
