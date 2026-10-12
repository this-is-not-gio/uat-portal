export type ManualNavItem = { title: string; slug: string }
export type ManualNavGroup = { label: string; items: ManualNavItem[] }

export const manualNav: ManualNavGroup[] = [
	{
		label: "Guide",
		items: [
			{ title: "Introduction", slug: "introduction" },
			{ title: "Getting Started", slug: "getting-started" },
			{ title: "Sign-off", slug: "sign-off" },
		],
	},
]

export const manualHref = (slug: string) => `/manual/guide/${slug}`
