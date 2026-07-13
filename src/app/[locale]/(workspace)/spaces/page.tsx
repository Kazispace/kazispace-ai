import { redirect } from 'next/navigation';

/**
 * `/spaces` has no index workspace — only `/spaces/[spaceId]`.
 * Clinic dialog lives at `/chat` (ADR-006).
 */
export default function SpacesIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/chat`);
}
