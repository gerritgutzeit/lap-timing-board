'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect /updates to Admin with Updates tab selected. */
export default function UpdatesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin?tab=updates');
  }, [router]);
  return (
    <div className="min-h-screen bg-f1-dark flex items-center justify-center text-f1-muted">
      Redirecting to Admin…
    </div>
  );
}
