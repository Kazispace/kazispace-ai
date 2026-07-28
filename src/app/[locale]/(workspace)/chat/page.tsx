"use client";

import { Suspense } from "react";
import { ClinicShell } from "@/components/clinic/clinic-shell";
import { Loader2 } from "lucide-react";

interface ChatPageProps {
  params: { locale: string };
}

function ChatPageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
    </div>
  );
}

export default function ChatPage({ params }: ChatPageProps) {
  return (
    <Suspense fallback={<ChatPageLoading />}>
      <ClinicShell locale={params.locale} />
    </Suspense>
  );
}
