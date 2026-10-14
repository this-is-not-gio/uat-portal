import { FileText, ImageIcon } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import type { ReportAttachment } from "@/lib/report/sign-off-remarks";

// Name and size of each file on a remark. Read-only; no links, so it is safe on paper and in the theme editor.
// No "use client": used from Server Components and the theme editor.
export function AttachmentChips({ attachments, className }: { attachments?: ReportAttachment[]; className?: string }) {
	if (!attachments?.length) return null;
	return (
		<ul className={cn("flex flex-wrap gap-1.5", className)}>
			{attachments.map((a) => {
				const Icon = a.contentType.startsWith("image/") ? ImageIcon : FileText;
				return (
					<li key={a.id} title={a.fileName} className="flex max-w-56 items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 text-xs">
						<Icon className="size-3 shrink-0 text-muted-foreground" />
						<span className="truncate">{a.fileName}</span>
						<span className="shrink-0 text-muted-foreground">{formatFileSize(a.sizeBytes)}</span>
					</li>
				);
			})}
		</ul>
	);
}
