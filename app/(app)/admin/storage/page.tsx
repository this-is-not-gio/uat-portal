import { HardDrive } from "lucide-react";
import { CleanUpStorageButton } from "./clean-up-storage-button";

// Attachment files are removed from the bucket automatically after resets and deletions; this is
// the manual backstop for when that lags (a failed bucket delete stays queued).
export default function AdminStoragePage() {
	return (
		<div className="px-2 flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<div className="flex flex-row gap-2 items-center">
					<HardDrive className="size-5" />
					<p className="text-sm font-semibold">Storage</p>
				</div>
				<p className="text-xs text-muted-foreground">
					Clears attachment drafts left unposted for over an hour (everyone&apos;s) and removes files nothing references any more from the bucket.
				</p>
			</div>
			<CleanUpStorageButton />
		</div>
	);
}
