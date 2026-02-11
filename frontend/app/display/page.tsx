'use client';

import { useEffect, useState } from 'react';
import { fetchDisplayView, type DisplayView } from '@/lib/api';

const POLL_INTERVAL_MS = 2000;

export default function DisplayPage() {
  const [view, setView] = useState<DisplayView | null>(null);

  useEffect(() => {
    let cancelled = false;

    const update = () => {
      fetchDisplayView()
        .then((v) => {
          if (!cancelled) setView(v);
        })
        .catch(() => {
          if (!cancelled) setView('dashboard');
        });
    };

    update();
    const interval = setInterval(update, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (view === null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-techie-bg text-techie-text font-mono">
        <p className="text-techie-dim animate-pulse">Loading display…</p>
      </main>
    );
  }

  const src = view === 'carousel' ? '/carousel' : '/dashboard';

  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-techie-bg">
      <iframe
        key={view}
        src={src}
        title="Display"
        className="w-full h-full border-0 block"
        sandbox="allow-same-origin allow-scripts"
      />
    </main>
  );
}
