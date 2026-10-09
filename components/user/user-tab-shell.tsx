"use client"

import { useRouter, useSelectedLayoutSegment } from "next/navigation"
import { Building2, IdCard, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"

// Each tab is a route under /admin, so the URL (not state) decides which one is active.
export default function UserTabShell() {
	const router = useRouter()
	const value = useSelectedLayoutSegment() ?? "users"
	return (
		<div className="px-6 border-b border-b-gray-200">
			<Tabs value={value} onValueChange={(tab) => router.push(`/admin/${tab}`)}>
				<TabsList variant="line" className="w-fit">
					<TabsTrigger value="users" className="text-xs"><Users data-icon="inline-start" />Participants</TabsTrigger>
					<TabsTrigger value="organizations" className="text-xs"><Building2 data-icon="inline-start" />Organization</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	)
}
