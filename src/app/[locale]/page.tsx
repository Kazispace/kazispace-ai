import { redirect } from "next/navigation";

interface LocaleHomeProps {
  params: { locale: string };
}

/** W1: default locale entry is Clinic Shell */
export default function LocaleHome({ params }: LocaleHomeProps) {
  redirect(`/${params.locale}/chat`);
}
