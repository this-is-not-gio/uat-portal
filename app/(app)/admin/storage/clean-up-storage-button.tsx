"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cleanUpStorage } from "@/lib/supabase/attachment-actions";

export function CleanUpStorageButton() {
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

	function run() {
		setMessage(null);
		startTransition(async () => {
			const result = await cleanUpStorage();
			setMessage(result.ok
				? { text: `Cleared ${result.data.draftsCleared} stale draft${result.data.draftsCleared === 1 ? "" : "s"} and removed ${result.data.objectsRemoved} file${result.data.objectsRemoved === 1 ? "" : "s"} from the bucket.`, error: false }
				: { text: result.error, error: true });
		});
	}

	return (
		<div className="flex flex-col gap-2 items-start">
			<Button size="sm" onClick={run} disabled={pending}>{pending ? "Cleaning up…" : "Clean up storage"}</Button>
			{message && <p className={`text-xs ${message.error ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>}
		</div>
	);
}
