import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-f1-dark">
      <div className="text-center animate-fade-in">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
          F1 TIMING
        </h1>
        <p className="text-f1-muted text-lg mb-12">Dashboard</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-f1-red text-white font-display font-semibold rounded-lg hover:bg-red-600 transition-colors"
          >
            LIVE DASHBOARD
          </Link>
          <Link
            href="/carousel"
            className="px-8 py-4 border border-f1-border text-f1-text font-display font-medium rounded-lg hover:bg-f1-panel transition-colors"
          >
            CAROUSEL
          </Link>
          <Link
            href="/drivers"
            className="px-8 py-4 border border-f1-border text-f1-text font-display font-medium rounded-lg hover:bg-f1-panel transition-colors"
          >
            DRIVERS
          </Link>
          <Link
            href="/admin"
            className="px-8 py-4 border border-f1-border text-f1-text font-display font-medium rounded-lg hover:bg-f1-panel transition-colors"
          >
            ADMIN
          </Link>
        </div>
      </div>
    </main>
  );
}
