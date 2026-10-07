import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/supabase/auth";
import { LoginForm } from "./login-form";
import { ClipboardList } from "lucide-react";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ redirectTo?: string }>;
}) {
	const { redirectTo } = await searchParams;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		redirect(safeRedirect(redirectTo));
	}

	return (
		<div className="flex min-h-svh flex-col items-center justify-center bg-blue-900 p-4 sm:p-6 md:p-10">
			{/* <div className="w-full max-w-sm md:max-w-4xl">
				<LoginForm redirectTo={redirectTo} />
			</div> */}
			<div className="bg-white p-5 sm:p-6 md:p-8 rounded-lg w-full max-w-sm sm:max-w-md flex flex-col gap-6 md:gap-8">
				<div className="flex flex-row gap-2 items-center justify-between">
					<div className="flex aspect-square items-center size-10 justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-2xl">
						<ClipboardList className="size-5!" />
					</div>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-semibold">User Acceptance Test</span>
						<span className="truncate text-xs text-muted-foreground">Licensing Project</span>
					</div>
				</div>
				<div className="">
					<p className="font-bold text-xl sm:text-2xl">Start Testing</p>
					<p className="text-xs text-muted-foreground">Start testing your application and solve some test cases.</p>
				</div>
				<LoginForm />
			</div>
		</div>
	);
}
