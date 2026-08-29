'use client';

import { useEffect } from 'react';

// Root-level error boundary — catches crashes in the root layout itself
// (e.g. NextIntlClientProvider setup), where locale/translations aren't
// available. Must render its own <html>/<body>; kept dependency-free.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: '24rem', fontSize: '0.875rem', color: '#6B7280' }}>
            An unexpected error occurred. You can try again or reload the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#111827',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
