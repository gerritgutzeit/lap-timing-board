'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchLaps, fetchDisabledDrivers, setDisabledDrivers, deleteDriverLaps } from '@/lib/api';

export default function DriversListPage() {
  const [laps, setLaps] = useState<{ driver_name: string }[]>([]);
  const [disabledDrivers, setDisabledDriversState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lapsData, disabledData] = await Promise.all([
        fetchLaps(),
        fetchDisabledDrivers().catch(() => []),
      ]);
      setLaps(lapsData);
      setDisabledDriversState(disabledData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  };

  const isDisabled = (name: string) => disabledDrivers.includes(name);

  const handleToggleEnabled = async (e: React.MouseEvent, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActioning(name);
    setError(null);
    try {
      const next = isDisabled(name)
        ? disabledDrivers.filter((n) => n !== name)
        : [...disabledDrivers, name];
      await setDisabledDrivers(next);
      setDisabledDriversState(next);
      showSuccess(isDisabled(name) ? `${name} enabled` : `${name} disabled`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setActioning(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete all lap times for "${name}"? This cannot be undone.`)) return;
    setActioning(name);
    setError(null);
    try {
      const { deleted } = await deleteDriverLaps(name);
      showSuccess(`${name}: ${deleted} lap(s) deleted`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActioning(null);
    }
  };

  const driverNames = Array.from(
    new Map(laps.map((l) => [l.driver_name, true])).keys()
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return (
    <main className="min-h-screen bg-f1-dark p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
        <Link
          href="/admin"
          className="font-display text-xl md:text-2xl font-bold text-white hover:text-f1-red transition-colors"
        >
          F1 TIMING — Drivers
        </Link>
        <Link
          href="/admin"
          className="text-sm text-f1-muted hover:text-f1-text transition-colors"
        >
          ← Admin
        </Link>
      </header>

      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm mb-4">
            {success}
          </div>
        )}

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            DRIVERS
          </h2>
          <p className="text-f1-muted text-sm mb-4">
            Disabled drivers are hidden from the dashboard. Delete removes all their lap times.
          </p>
          {loading ? (
            <p className="text-f1-muted text-sm">Loading...</p>
          ) : driverNames.length === 0 ? (
            <p className="text-f1-muted text-sm">No drivers yet. Add lap times in Admin.</p>
          ) : (
            <ul className="space-y-1">
              {driverNames.map((name) => (
                <li
                  key={name}
                  className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-f1-dark transition-colors ${isDisabled(name) ? 'opacity-70' : ''}`}
                >
                  <Link
                    href={`/admin/drivers/${encodeURIComponent(name)}`}
                    className="flex-1 min-w-0 text-white hover:text-f1-red transition-colors truncate"
                  >
                    {name}
                    {isDisabled(name) && (
                      <span className="ml-2 text-f1-muted text-xs">(disabled)</span>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleToggleEnabled(e, name)}
                      disabled={actioning !== null}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                        isDisabled(name)
                          ? 'border-green-500/50 text-green-400 hover:bg-green-500/20'
                          : 'border-amber-500/50 text-amber-400 hover:bg-amber-500/20'
                      } disabled:opacity-50`}
                    >
                      {actioning === name ? '…' : isDisabled(name) ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, name)}
                      disabled={actioning !== null}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {actioning === name ? '…' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
