import { Skeleton } from "@/components/ui/skeleton";

// Mirrors OverviewTab's layout (same widths, borders and spacing) so the
// swap to real content doesn't shift the page.

// Varied line widths read as prose instead of a solid block.
const LINE_WIDTHS = ["w-full", "w-11/12", "w-full", "w-4/5", "w-2/3"];

function SectionCardSkeleton({ lines }: { lines: number }) {
	return (
		<div className="flex flex-col gap-1 border rounded-md">
			{/* --accent and --muted are the same token in this theme, so skeletons on
			    the accent header need a darker fill to stay visible. */}
			<div className="p-4 bg-accent border-b flex flex-row gap-2 items-center">
				<Skeleton className="size-4 rounded-sm bg-foreground/10" />
				<Skeleton className="h-4 w-40 bg-foreground/10" />
			</div>
			<div className="p-4 flex flex-col gap-2">
				{Array.from({ length: lines }, (_, index) => (
					<Skeleton key={index} className={`h-4 ${LINE_WIDTHS[index % LINE_WIDTHS.length]}`} />
				))}
			</div>
		</div>
	);
}

function DetailGroupSkeleton({ fields, badges }: { fields?: number; badges?: number }) {
	return (
		<div className="flex flex-col gap-4 py-6 border-b">
			<div className="flex flex-row gap-2 items-center">
				<Skeleton className="size-4 rounded-sm" />
				<Skeleton className="h-4 w-32" />
			</div>
			{fields ? (
				<div className="flex flex-col gap-3">
					{Array.from({ length: fields }, (_, index) => (
						<div key={index} className="flex flex-col gap-1">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-3 w-24" />
						</div>
					))}
				</div>
			) : null}
			{badges ? (
				<div className="flex flex-wrap gap-1">
					{Array.from({ length: badges }, (_, index) => (
						<Skeleton key={index} className={`h-5 rounded-full ${index % 2 === 0 ? "w-24" : "w-32"}`} />
					))}
				</div>
			) : null}
		</div>
	);
}

// Line counts roughly match each real section's length.
const SECTION_LINES = [3, 3, 5, 5, 4, 4, 4];

export default function OverviewTabSkeleton() {
	return (
		<div className="h-full overflow-hidden" aria-busy="true" aria-label="Loading overview">
			<div className="flex flex-col items-center py-10 w-300 mx-auto">
				<div className="flex flex-row w-full border-b pb-4 justify-between items-center">
					<div className="flex flex-row items-center gap-4">
						<Skeleton className="w-12 h-12 rounded-md" />
						<div className="flex flex-col gap-1.5">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				</div>
				<div className="flex flex-row w-full h-full justify-center gap-6">
					<div className="w-4xl flex flex-col gap-4 py-4">
						{SECTION_LINES.map((lines, index) => (
							<SectionCardSkeleton key={index} lines={lines} />
						))}
					</div>
					<div className="flex-1 h-full">
						<DetailGroupSkeleton fields={3} />
						<DetailGroupSkeleton fields={2} />
						<DetailGroupSkeleton badges={5} />
						<DetailGroupSkeleton fields={3} />
					</div>
				</div>
			</div>
		</div>
	);
}
