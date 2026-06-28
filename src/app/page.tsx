import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/lib/constants';

export default function Home() {
  redirect(`/${DEFAULT_LOCALE}/chat`);
}
