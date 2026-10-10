import { createClient } from "./server";

// Overview "Test Accounts". RLS returns nothing to testers whose org isn't in
// one of the suite's rounds, so they simply see no card.
export type suiteTestAccount = {
	id: string;
	role: string | null; // a test role name from the /admin role catalog (test_roles)
	username: string;
	password: string;
};

export async function getSuiteTestAccounts(suiteId: string): Promise<suiteTestAccount[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("suite_test_accounts")
		.select("id, role, username, password")
		.eq("testing_suite_id", suiteId)
		.order("sort_order");
	if (error) throw error;
	return data;
}

// Overview custom sections (header, Lucide icon name, Markdown content). Same
// visibility as test accounts.
export type suiteOverviewSection = {
	id: string;
	title: string;
	icon: string | null;
	content: string;
};

export async function getSuiteOverviewSections(suiteId: string): Promise<suiteOverviewSection[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("suite_overview_sections")
		.select("id, title, icon, content")
		.eq("testing_suite_id", suiteId)
		.order("sort_order");
	if (error) throw error;
	return data;
}

// Overview "Endpoints" (name + URL). Same visibility as test accounts.
export type suiteEndpoint = {
	id: string;
	name: string;
	url: string;
};

export async function getSuiteEndpoints(suiteId: string): Promise<suiteEndpoint[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("suite_endpoints")
		.select("id, name, url")
		.eq("testing_suite_id", suiteId)
		.order("sort_order");
	if (error) throw error;
	return data;
}
