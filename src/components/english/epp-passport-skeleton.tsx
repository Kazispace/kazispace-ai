'use client';

import { Card, CardContent } from '@/components/ui/card';

export function EppPassportSkeleton() {
  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full animate-pulse">
      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="flex gap-3">
            <div className="h-12 w-16 bg-gray-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 bg-gray-100 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
