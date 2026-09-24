import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"

const emptyStateVariants = cva(
	"w-full flex flex-col items-center justify-center text-center",
	{
		variants: {
			size: {
				default: "py-8 gap-4",
				sm: "py-4 gap-2",
				lg: "py-12 gap-5",
			},
		},
		defaultVariants: {
			size: "default",
		},
	}
)

function EmptyState({
	icon: Icon,
	title,
	description,
	size,
	className,
}: {
	icon: LucideIcon
	title: string
	description?: string
} & VariantProps<typeof emptyStateVariants> & { className?: string }) {
	return (
		<div data-slot="empty-state" className={cn(emptyStateVariants({ size }), className)}>
			<div className="bg-muted/50 rounded-xl p-2 flex flex-col items-center gap-2">
				<Icon size={25} className="text-muted-foreground" />
			</div>
			<div className="flex flex-col items-center justify-center gap-1">
				<p className="font-semibold text-muted-foreground">{title}</p>
				{description ? (
					<p className="text-xs text-muted-foreground">{description}</p>
				) : null}
			</div>
		</div>
	)
}

export { EmptyState, emptyStateVariants }
