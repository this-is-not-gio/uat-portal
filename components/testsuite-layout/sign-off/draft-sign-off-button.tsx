"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSignOff } from "@/lib/supabase/iteration-actions";

// Sign-off Rejected → For Sign-off (vendor): starts a new draft and opens it in the Sign-off tab.
export default function DraftSignOffButton({ suiteId, testSuiteSlug }: { suiteId: string; testSuiteSlug: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onClick() {
		setError(null);
		startTransition(async () => {
			const result = await createSignOff({ suiteId });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			router.push(`/testsuite/${testSuiteSlug}/sign-off`);
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button onClick={onClick} disabled={isPending} className="flex flex-row items-center gap-2">
				<Stamp className="h-4 w-4" />
				<p className="text-xs">{isPending ? "Creating draft…" : "Draft Sign-off Report"}</p>
			</Button>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
