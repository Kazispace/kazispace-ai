import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/lib/constants';

/** KAZI-1245: the locale root decides between the homepage and the app (see [locale]/page). */
export default function Home() {
  redirect(`/${DEFAULT_LOCALE}`);
}
