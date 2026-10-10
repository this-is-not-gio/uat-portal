import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Raleway } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";


const montserratHeading = Montserrat({subsets:['latin'],variable:'--font-heading'});


const raleway = Raleway({
	subsets: ["latin"],
	variable: "--font-raleway",
});

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "UAT Portal",
	description: "Plan, run and sign off user acceptance testing rounds across development, client and external teams.",
};


// Document shell only. Which chrome a page gets is decided by its route group:
// (auth) renders bare, (app) renders the sidebar shell for a signed-in user.
export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, montserratHeading.variable, raleway.variable)}
		>
			<body className="h-full flex flex-col overflow-hidden">
				{children}
				<Toaster position="bottom-right" />
			</body>
		</html>
	);
}
