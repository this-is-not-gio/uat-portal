# UAT Portal

Next.js (App Router) app for running UAT testing suites (sections, test cases, testing rounds, results, sign-off), backed by Supabase with role-based access.

- Run locally: copy `.env.example` to `.env.local`, fill it in, `npm ci`, `npm run dev`.
- Checks: `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Environments, CI/CD, migrations and release flow: [docs/deployment.md](docs/deployment.md).
- Architecture and conventions: [CLAUDE.md](CLAUDE.md).
