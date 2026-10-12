import { Info } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

export type TocItem = { id: string; label: string }

export function Code({ children }: { children: React.ReactNode }) {
	return (
		<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
	)
}

export function Callout({
	icon: Icon,
	title,
	children,
}: {
	icon: typeof Info
	title: string
	children: React.ReactNode
}) {
	return (
		<div className="my-4 flex gap-3 rounded-lg border bg-muted/50 p-4">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<div className="space-y-1 text-sm">
				<p className="font-medium">{title}</p>
				<p className="text-muted-foreground">{children}</p>
			</div>
		</div>
	)
}

export function DocShell({ toc, children }: { toc: TocItem[]; children: React.ReactNode }) {
	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="mx-auto flex max-w-5xl gap-10 px-8 py-10">
				<article className="min-w-0 flex-1 space-y-10 text-sm leading-7">{children}</article>
				<aside className="sticky top-10 hidden h-fit w-44 shrink-0 lg:block">
					<p className="mb-2 text-xs font-medium">On this page</p>
					<ul className="space-y-1.5 border-l text-xs">
						{toc.map((item) => (
							<li key={item.id}>
								<a
									href={`#${item.id}`}
									className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-foreground hover:text-foreground"
								>
									{item.label}
								</a>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</ScrollArea>
	)
}
