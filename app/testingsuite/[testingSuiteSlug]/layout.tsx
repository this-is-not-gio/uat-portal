import { ImportStagingProvider } from "./components/import-staging";

export default function TestingSuiteLayout({ children }: { children: React.ReactNode }) {
	return <ImportStagingProvider>{children}</ImportStagingProvider>;
}
