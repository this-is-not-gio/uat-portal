import { Constants, type Database } from "@/lib/supabase/database.types";

type roleAssignee = Database["public"]["Enums"]["role_assignee_type"];

// Words inside a role name may be split by spaces, hyphens or underscores, or
// nothing at all: "IC-Admin", "ic admin" and "ICAdmin" all match.
const rolePattern = (name: string) =>
	new RegExp(`\\b${name.split(/[\s-]+/).join("[\\s_-]*")}\\b`, "gi");

// Every role by its full name, plus older names still found in test case files.
const FULL_NAMES = [
	...Constants.public.Enums.role_assignee_type.map((role) => ({ role, pattern: rolePattern(role) })),
	{ role: "IC Admin" as roleAssignee, pattern: rolePattern("Kora Admin") },
];

// Bare words, read only when no full name was found anywhere in the case.
// A word with one role picks it; a word with several only lists them.
const BARE_WORDS: { pattern: RegExp; roles: roleAssignee[] }[] = [
	{ pattern: /\badmin(istrator)?s?\b/gi, roles: ["IC Admin"] },
	{ pattern: /\bcommissioners?\b/gi, roles: ["Deputy-Commissioner", "Insurance Commissioner"] },
];

export type roleMatch =
	| { kind: "found"; role: roleAssignee }
	| { kind: "ambiguous"; candidates: roleAssignee[] }
	| { kind: "none" };

const toMatch = (roles: Set<roleAssignee>): roleMatch =>
	roles.size === 1 ? { kind: "found", role: [...roles][0] }
		: roles.size > 1 ? { kind: "ambiguous", candidates: [...roles] }
			: { kind: "none" };

// Roles one piece of text names in full, and the text left once those names
// are cut out (so "Company Admin" doesn't also count as a bare "admin").
function fullNames(text: string) {
	const roles = new Set<roleAssignee>();
	let rest = text;
	for (const { role, pattern } of FULL_NAMES) {
		rest = rest.replace(pattern, () => {
			roles.add(role);
			return " ";
		});
	}
	return { roles, rest };
}
function bareWords(text: string) {
	const roles = new Set<roleAssignee>();
	for (const { pattern, roles: wordRoles } of BARE_WORDS) {
		if (text.match(pattern)) wordRoles.forEach((role) => roles.add(role));
	}
	return roles;
}

// Guesses a case's role assignee from its title, then its preconditions
// ("Logged in as Supervisor"). Steps are not read: they often mention other
// roles the case hands off to. Full names beat bare words anywhere in the
// case, so "Admin edits" with "Logged in as Company Admin" is Company Admin.
export function detectRoleAssignee(title: string, preconditions: string[]): roleMatch {
	const texts = [title, preconditions.join("\n")].map(fullNames);

	for (const level of [texts.map((t) => t.roles), texts.map((t) => bareWords(t.rest))]) {
		const candidates = new Set<roleAssignee>();
		for (const roles of level) {
			const match = toMatch(roles);
			if (match.kind === "found") return match;
			roles.forEach((role) => candidates.add(role));
		}
		if (candidates.size) return toMatch(candidates);
	}
	return { kind: "none" };
}
