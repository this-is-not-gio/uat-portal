"use client";

import { LogOut } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { signOut } from "@/app/login/actions";

export function SignOutButton() {
	return (
		<form action={signOut}>
			<SidebarMenuButton type="submit">
				<LogOut />
				<span>Sign out</span>
			</SidebarMenuButton>
		</form>
	);
}
