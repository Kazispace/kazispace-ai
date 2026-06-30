import Script from 'next/script';

export function TmaScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="beforeInteractive"
    />
  );
}
