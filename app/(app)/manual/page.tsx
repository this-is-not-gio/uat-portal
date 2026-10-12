import { redirect } from "next/navigation"
import { manualHref, manualNav } from "@/components/manual/manual-nav"

export default function ManualPage() {
	redirect(manualHref(manualNav[0].items[0].slug))
}
