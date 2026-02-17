'use client';

import { useEffect, useState } from 'react';
import {
  fetchPendingLaps,
  updatePendingLap,
  discardPendingLap,
  confirmPendingLap,
  type PendingLapUpdate,
} from '@/lib/api';

function formatSuggestedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function AdminUpdatesTab() {
  const [pending, setPending] = useState<PendingLapUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDriver, setEditDriver] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setError(null);
    try {
      const list = await fetchPendingLaps();
      setPending(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearFeedback = () => {
    setSuccess(null);
    setError(null);
  };

  const handleDiscard = async (item: PendingLapUpdate) => {
    setBusyId(item.id);
    setError(null);
    try {
      await discardPendingLap(item.id);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
      setSuccess('Discarded.');
      setTimeout(clearFeedback, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to discard');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirm = async (item: PendingLapUpdate) => {
    setBusyId(item.id);
    setError(null);
    try {
      await confirmPendingLap(item.id);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
      setSuccess(`Lap added to times: ${item.track_name} – ${item.lap_time}`);
      setTimeout(clearFeedback, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (item: PendingLapUpdate) => {
    setEditingId(item.id);
    setEditDriver(item.driver_name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDriver('');
  };

  const saveEditAndConfirm = async (item: PendingLapUpdate) => {
    setBusyId(item.id);
    setError(null);
    try {
      const name = editDriver.trim() || item.driver_name;
      await updatePendingLap(item.id, name);
      await confirmPendingLap(item.id);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
      setEditingId(null);
      setEditDriver('');
      setSuccess(`Lap added: ${item.track_name} – ${item.lap_time} (${name})`);
      setTimeout(clearFeedback, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save and confirm');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
      <h2 className="font-display text-lg font-semibold text-white mb-2">Pending updates</h2>
      <p className="text-f1-muted text-sm mb-4">
        When a live lap is faster than the driver&apos;s best (or overall record), it appears here. Confirm to add it to your times, or discard. You can edit the driver name before confirming.
      </p>

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

      {loading ? (
        <p className="text-f1-muted">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="bg-f1-dark/50 border border-f1-border rounded-lg p-6 text-center text-f1-muted">
          No pending updates. New suggestions will appear here when a live lap beats the driver&apos;s best or the track record.
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((item) => (
            <li
              key={item.id}
              className="bg-f1-dark/50 border border-f1-border rounded-xl p-4 flex flex-wrap items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{item.track_name}</p>
                <p className="font-mono text-f1-red text-lg">{item.lap_time}</p>
                {item.previous_lap_time ? (
                  <p className="text-f1-muted text-sm mt-0.5">
                    Replaces previous: <span className="font-mono text-f1-text">{item.previous_lap_time}</span>
                  </p>
                ) : (
                  <p className="text-f1-muted text-sm mt-0.5 italic">First lap for this driver on this track</p>
                )}
                {editingId === item.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editDriver}
                      onChange={(e) => setEditDriver(e.target.value)}
                      placeholder="Driver name"
                      className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[140px]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => saveEditAndConfirm(item)}
                      disabled={busyId === item.id}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50"
                    >
                      Save & confirm
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-f1-muted hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-f1-muted text-sm">Driver: {item.driver_name}</p>
                )}
                <p className="text-f1-muted text-xs mt-1">{formatSuggestedAt(item.suggested_at)}</p>
              </div>
              {editingId !== item.id && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirm(item)}
                    disabled={busyId === item.id}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={busyId === item.id}
                    className="px-4 py-2 bg-f1-panel border border-f1-border text-f1-text text-sm font-medium rounded-lg hover:bg-f1-border/30 disabled:opacity-50"
                  >
                    Edit driver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscard(item)}
                    disabled={busyId === item.id}
                    className="px-4 py-2 border border-red-500/50 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
