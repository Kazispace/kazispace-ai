import { SessionNavShell } from '@/components/session-nav';

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return <SessionNavShell locale={params.locale}>{children}</SessionNavShell>;
}
