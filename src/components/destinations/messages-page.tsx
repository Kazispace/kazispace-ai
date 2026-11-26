'use client';

import { useTranslations } from 'next-intl';

/**
 * Messages (KAZI-1485, kazispace-ui D36, Messages 0.1): what the user receives, in two sections,
 * My messages then Forum. A section with nothing in it says so in one line and is never left out.
 *
 * There is no message or forum endpoint yet, so both sections show their empty line and the
 * navigation item never shows the unread dot. When an endpoint ships, the rows, the unread dot
 * (`nav.messagesUnread`) and the loading / error states of the spec come with it.
 */
export function MessagesPage() {
  const tNav = useTranslations('nav');
  const t = useTranslations('messages');
  const sections = [
    { id: 'personal', title: t('personal'), empty: t('personalEmpty') },
    { id: 'forum', title: t('forum'), empty: t('forumEmpty') },
  ] as const;
  return (
    <div className="h-full overflow-y-auto bg-gray-bg" data-testid="messages-page">
      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <h1 className="text-xl font-semibold text-workspace-text">{tNav('messages')}</h1>
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`messages-${section.id}`} data-testid={`messages-${section.id}`}>
            <h2 id={`messages-${section.id}`} className="mb-2 text-sm font-semibold text-workspace-text">
              {section.title}
            </h2>
            <p className="text-sm text-workspace-secondary">{section.empty}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
