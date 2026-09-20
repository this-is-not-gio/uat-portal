"use client";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import { File, Folder, ChevronRight } from "lucide-react";
import {usePathname, useSearchParams, useRouter} from "next/navigation";

export default function SectionLeaf({ name, id }: { name: string; id: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function handleClick() {
		const params = new URLSearchParams(searchParams.toString());
		params.set("sectionId", id);
		router.push(`${pathname}?${params.toString()}`);
	}

	return (
			<SidebarMenuButton onClick={handleClick} className="data-[active=true]:bg-transparent">
				<File/>
				{name}
			</SidebarMenuButton>
	)
}
