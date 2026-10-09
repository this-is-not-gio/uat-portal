import { ClipboardList } from "lucide-react";
import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center bg-blue-900 p-4 sm:p-6 md:p-10">
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
				<div>
					<p className="font-bold text-xl sm:text-2xl">Welcome Tester</p>
					<p className="text-xs text-muted-foreground">You'll use it to sign in to the UAT Portal from now on.</p>
				</div>
				<div className="flex flex-col gap-2">
					<div className="">
						<p className="font-bold text-sm">Set your password</p>
						<p className="text-xs text-muted-foreground">Pick something only you know, and keep it safer than your last bug report.</p>
					</div>
					<SetPasswordForm />
				</div>
			</div>
		</div>
	);
}
