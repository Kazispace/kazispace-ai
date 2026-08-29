import Script from 'next/script';

export function TmaScript() {
  return (
    // The Telegram WebApp SDK must run before hydration (theme detection,
    // safe-area insets). This rule assumes the Pages Router's
    // pages/_document.js; for App Router, root layout.tsx (where this is
    // rendered) is the documented equivalent location for beforeInteractive.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="beforeInteractive"
    />
  );
}
