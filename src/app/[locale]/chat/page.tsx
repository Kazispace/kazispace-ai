"use client";

import { ClinicShell } from "@/components/clinic/clinic-shell";

interface ChatPageProps {
  params: { locale: string };
}

export default function ChatPage({ params }: ChatPageProps) {
  return <ClinicShell locale={params.locale} />;
}
