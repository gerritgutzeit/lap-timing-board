'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchLaps,
  updateLap,
  deleteLap,
  type Lap,
} from '@/lib/api';

const LAP_TIME_REGEX = /^\d{1,2}:\d{2}\.\d{3}$/;

export default function DriverDetailPage() {
  const params = useParams();
  const driverName = typeof params.driverName === 'string' ? decodeURIComponent(params.driverName) : '';

  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingLapId, setEditingLapId] = useState<number | null>(null);
  const [editLapTime, setEditLapTime] = useState('');

  const load = useCallback(async () => {
    const name = typeof driverName === 'string' ? driverName.trim() : '';
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLaps({ driverName: name });
      setLaps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load laps');
    } finally {
      setLoading(false);
    }
  }, [driverName]);

  useEffect(() => {
    load();
  }, [load]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  };

  const startEdit = (lap: Lap) => {
    setEditingLapId(lap.id);
    setEditLapTime(lap.lap_time);
  };

  const cancelEdit = () => {
    setEditingLapId(null);
    setEditLapTime('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLapId == null) return;
    if (!editLapTime.trim()) {
      setError('Lap time is required');
      return;
    }
    if (!LAP_TIME_REGEX.test(editLapTime.trim())) {
      setError('Lap time must be mm:ss.xxx (e.g. 1:23.456)');
      return;
    }
    try {
      await updateLap(editingLapId, { lap_time: editLapTime.trim() });
      showSuccess('Lap time updated');
      cancelEdit();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update lap');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lap time?')) return;
    try {
      await deleteLap(id);
      showSuccess('Lap deleted');
      if (editingLapId === id) cancelEdit();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete lap');
    }
  };

  if (!driverName) {
    return (
      <main className="min-h-screen bg-f1-dark p-4 md:p-8">
        <p className="text-f1-muted">Invalid driver.</p>
        <Link href="/admin/drivers" className="text-f1-red hover:underline mt-2 inline-block">
          ← Drivers
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f1-dark p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
        <Link
          href="/admin/drivers"
          className="font-display text-xl md:text-2xl font-bold text-white hover:text-f1-red transition-colors"
        >
          ← {driverName}
        </Link>
        <Link
          href="/admin"
          className="text-sm text-f1-muted hover:text-f1-text transition-colors"
        >
          Admin
        </Link>
      </header>

      <div className="max-w-3xl mx-auto">
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
            LAP TIMES — {driverName}
          </h2>
          <p className="text-f1-muted text-xs mb-4">
            Format: mm:ss.xxx (e.g. 1:23.456)
          </p>
          {loading ? (
            <p className="text-f1-muted text-sm">Loading...</p>
          ) : laps.length === 0 ? (
            <p className="text-f1-muted text-sm">No lap times for this driver.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-f1-muted border-b border-f1-border">
                    <th className="py-2 pr-4 font-mono">Lap time</th>
                    <th className="py-2 pr-4">Track</th>
                    <th className="py-2 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {laps.map((lap) => (
                    <tr
                      key={lap.id}
                      className="border-b border-f1-border last:border-0"
                    >
                      {editingLapId === lap.id ? (
                        <td colSpan={3} className="py-2">
                          <form
                            onSubmit={handleSave}
                            className="flex flex-wrap items-center gap-3 py-2"
                          >
                            <input
                              type="text"
                              value={editLapTime}
                              onChange={(e) => setEditLapTime(e.target.value)}
                              placeholder="1:23.456"
                              className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white font-mono text-sm w-[100px] focus:outline-none focus:ring-2 focus:ring-f1-red"
                            />
                            <span className="text-f1-muted text-sm">
                              {lap.track_name || '-'}
                            </span>
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-f1-red text-white text-sm font-medium rounded-lg hover:bg-red-600"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-3 py-1.5 border border-f1-border text-f1-muted text-sm rounded-lg hover:text-white"
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td className="py-3 pr-4 font-mono text-white">
                            {lap.lap_time}
                          </td>
                          <td className="py-3 pr-4 text-f1-muted">
                            {lap.track_name || '-'}
                          </td>
                          <td className="py-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(lap)}
                              className="text-amber-400 hover:text-amber-300 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(lap.id)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
