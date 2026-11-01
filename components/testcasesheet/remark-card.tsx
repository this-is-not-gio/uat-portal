import { User, UserCheck, type LucideIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASSNAMES } from "@/components/defects/defect-badges";
import type { signedAttachment } from "@/lib/supabase/attachment-actions";
import type { defect } from "@/lib/supabase/defects";
import type { testRemark } from "@/lib/supabase/test-cases";
import { cn, humanizeTimestamp } from "@/lib/utils";
import { RemarkAttachments } from "./remark-attachments";

const author_role_badge_classnames: Record<string, { className: string, Icon: LucideIcon }> = {
	Internal: { className: "bg-blue-100/60 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 border-blue-700 dark:border-blue-400", Icon: User },
	External: { className: "bg-green-100/60 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 border-green-700 dark:border-green-40０", Icon: UserCheck },
}

// One posted remark (step or case level): author header, markdown body, evidence files.
// action: an extra control in the card header (e.g. Create defect).
// defects: the defects citing this remark, shown as DEF chips that open the defect.
export function RemarkCard({ remark, files, action, defects = [], onOpenDefect }: { remark: testRemark; files: signedAttachment[]; action?: React.ReactNode; defects?: defect[]; onOpenDefect?: (id: string) => void }) {
	const author_role_badge = remark.author?.role ? author_role_badge_classnames[remark.author.role] : undefined
	const Icon = author_role_badge?.Icon
	const initials = `${remark.author?.full_name?.charAt(0) || 'U'}${remark.author?.full_name?.charAt(1).toUpperCase() || 'U'}`
	return (<div className="flex flex-row gap-2 group/remark">
		<div className="hidden sm:flex flex-col items-center group-first/remark:pt-4">
			<div className="w-0.5 h-2 bg-accent rounded-full self-center group-first/remark:h-0"></div>
			<div className="size-10 rounded-full p-4 flex flex-col items-center justify-center gap-2 bg-primary text-white">
				<p className="text-xs font-bold">{initials}</p>
			</div>
			<div className="w-0.5 h-full bg-muted rounded-full self-center group-last/remark:h-0"></div>
		</div>
		<div className="border w-full min-w-0 bg-accent/10 rounded-xl mb-3 sm:mb-5 group-last/remark:mb-0">
			{/* Mobile drops the avatar column (the avatar moves in here) and the role badge. */}
			<div className="flex flex-row items-center justify-between gap-2 border-b p-3 sm:p-4 mb-0 bg-accent/90 rounded-t-xl">
				<div className="flex-row flex min-w-0 gap-2 items-center">
					<div className="sm:hidden size-6 shrink-0 rounded-full flex items-center justify-center bg-primary text-white">
						<p className="text-[10px] font-bold">{initials}</p>
					</div>
					<div className="">
						<p className="text-xs sm:text-sm font-semibold truncate">{remark.author?.full_name || 'Unknown Author'}</p>
						<p className="text-xs sm:text-xs text-muted-foreground truncate">{remark.roleName || remark.author?.role || 'Unknown Role'}</p>
					</div>
				</div>
							<p className="text-xs text-muted-foreground font-mono">{remark.created_at ? humanizeTimestamp(remark.created_at) : 'Unknown Time'}</p>
			</div>
			<div className="p-3 sm:p-4 overflow-x-auto">
				{remark.remark.trim() && (
					<div className="typeset text-sm break-words">
						<ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{remark.remark}</ReactMarkdown>
					</div>
				)}
				<RemarkAttachments attachments={files} />
			</div>
		</div>
	</div>
	)
}
