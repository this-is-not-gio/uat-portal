import Link from "next/link";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOffReportView } from "@/components/sign-off-report/sign-off-report-view";
import { SignOffPicker } from "@/components/sign-off-report/sign-off-picker";
import { getSignOffReport } from "@/lib/supabase/sign-off-report";
import type { signOff } from "@/lib/supabase/overview";

// Sign-off tab (Admin and Internal): the frozen report inline, with a picker for earlier or
// withdrawn sign-offs. Printing goes through the standalone report page.
export default async function SignOffTab({ suiteSlug, signOffs, selectedId }: { suiteSlug: string; signOffs: signOff[]; selectedId: string }) {
	const frozen = await getSignOffReport({ suiteSlug, signOffId: selectedId });

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<article className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-16">
				<div className="flex flex-row items-center justify-between gap-4">
					<div>{signOffs.length > 1 && <SignOffPicker suiteSlug={suiteSlug} signOffs={signOffs} selectedId={selectedId} />}</div>
					{/* <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/testingsuite/${suiteSlug}/sign-off/${selectedId}/report`} target="_blank" />}>
						<PrinterIcon />
						Open printable version
					</Button> */}
				</div>
				{frozen ? <SignOffReportView frozen={frozen} /> : <p className="text-sm text-muted-foreground">This sign-off has no report.</p>}
			</article>
		</div>
	);
}
