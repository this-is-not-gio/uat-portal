export function SummaryCard({ label, count, unit, icon, iconClassName }: { label: string; count: number; unit: string; icon: React.ReactNode; iconClassName?: string }) {
	return (
		<div className="flex flex-row items-center gap-2 border p-3 md:p-4 rounded-md w-full bg-gray-50/10">
			<div className={`size-10 md:size-12 shrink-0 border rounded-md flex flex-row items-center justify-center ${iconClassName ?? "bg-gray-50/50"}`}>
				{icon}
			</div>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<div className="flex flex-row items-end gap-1">
					<p className="font-mono font-semibold text-xl">{count}</p>
					<p className="text-xs text-muted-foreground">{unit}</p>
				</div>
			</div>
		</div>
	);
}
