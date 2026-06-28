import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KaziSpace - AI Career Coach',
  description: 'AI-powered career preparation platform for Central Asia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
