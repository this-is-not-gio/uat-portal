import { ManualSidebar } from "@/components/manual/manual-sidebar";
import { BookCopy } from "lucide-react";

export default function ManualPageLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex flex-row gap-4 p-8 border-b">
				<div className="p-3 bg-accent rounded-lg w-fit border border-accent-foreground">
					<BookCopy />
				</div>
				<div className="">
					<p className="text-lg font-semibold">Testing Manual</p>
					<p className="text-xs text-muted-foreground">This is where you can find the testing manual. It contains all the information you need to know about the testing process.</p>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-row">
				<ManualSidebar />
				{children}
			</div>
		</div>
	);
}



