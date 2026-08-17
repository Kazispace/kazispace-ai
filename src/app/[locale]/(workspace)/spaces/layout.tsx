import { SpaceWorkspaceKeepAlive } from '@/components/spaces/space-workspace-keep-alive';

export default function SpacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpaceWorkspaceKeepAlive>{children}</SpaceWorkspaceKeepAlive>;
}
