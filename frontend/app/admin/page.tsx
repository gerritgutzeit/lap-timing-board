'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchTracks,
  fetchLaps,
  fetchDashboardTracks,
  setDashboardTracks,
  fetchDashboardTitle,
  setDashboardTitle,
  fetchDashboardUp,
  setDashboardUp,
  getTrackOutlineTrackIds,
  uploadTrackOutline,
  createTrack,
  deleteTrack,
  createLap,
  updateLap,
  deleteLap,
  exportDatabase,
  importDatabase,
  getApiBase,
  type Track,
  type Lap,
  type DatabaseBackup,
} from '@/lib/api';

const MAX_DASHBOARD_TRACKS = 20;

const LAP_TIME_REGEX = /^\d{1,2}:\d{2}\.\d{3}$/;

export default function AdminPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackCountry, setNewTrackCountry] = useState('');
  const [newLapDriver, setNewLapDriver] = useState('');
  const [newLapTime, setNewLapTime] = useState('');
  const [newLapTrackId, setNewLapTrackId] = useState<string>('');
  const [dashboardTrackIds, setDashboardTrackIds] = useState<string[]>(['']);
  const [dashboardTitle, setDashboardTitleState] = useState<string>('F1 TIMING');
  const [dashboardUp, setDashboardUpState] = useState(true);
  const [trackOutlineTrackIds, setTrackOutlineTrackIds] = useState<number[]>([]);
  const [trackOutlineUploadingId, setTrackOutlineUploadingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingLapId, setEditingLapId] = useState<number | null>(null);
  const [editDriver, setEditDriver] = useState('');
  const [editLapTime, setEditLapTime] = useState('');
  const [apiBase, setApiBase] = useState<string>('');

  useEffect(() => {
    setApiBase(getApiBase());
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tracksData, lapsData, dashboardIds, title] = await Promise.all([
        fetchTracks(),
        fetchLaps(),
        fetchDashboardTracks(),
        fetchDashboardTitle().catch(() => 'F1 TIMING'),
      ]);
      setTracks(tracksData);
      setLaps(lapsData);
      if (tracksData.length && !newLapTrackId) setNewLapTrackId(String(tracksData[0].id));
      const ids = dashboardIds.map(String);
      setDashboardTrackIds(ids.length > 0 ? [...ids, ''] : ['']);
      setDashboardTitleState(title || 'F1 TIMING');
      const up = await fetchDashboardUp().catch(() => true);
      setDashboardUpState(up);
      const outlineIds = await getTrackOutlineTrackIds().catch(() => []);
      setTrackOutlineTrackIds(outlineIds);
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

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackName.trim() || !newTrackCountry.trim()) {
      setError('Name and country are required');
      return;
    }
    try {
      await createTrack(newTrackName.trim(), newTrackCountry.trim());
      setNewTrackName('');
      setNewTrackCountry('');
      showSuccess('Track created');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create track');
    }
  };

  const handleDeleteTrack = async (id: number) => {
    if (!confirm('Delete this track and all its lap times?')) return;
    try {
      await deleteTrack(id);
      showSuccess('Track deleted');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete track');
    }
  };

  const handleCreateLap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLapDriver.trim() || !newLapTime.trim() || !newLapTrackId) {
      setError('Driver, lap time and track are required');
      return;
    }
    if (!LAP_TIME_REGEX.test(newLapTime.trim())) {
      setError('Lap time must be mm:ss.xxx (e.g. 1:23.456)');
      return;
    }
    try {
      await createLap(newLapDriver.trim(), newLapTime.trim(), Number(newLapTrackId));
      setNewLapDriver('');
      setNewLapTime('');
      showSuccess('Lap time added');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add lap');
    }
  };

  const startEditLap = (lap: Lap) => {
    setEditingLapId(lap.id);
    setEditDriver(lap.driver_name);
    setEditLapTime(lap.lap_time);
  };

  const cancelEditLap = () => {
    setEditingLapId(null);
    setEditDriver('');
    setEditLapTime('');
  };

  const handleSaveLap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLapId == null) return;
    if (!editDriver.trim() || !editLapTime.trim()) {
      setError('Driver and lap time are required');
      return;
    }
    if (!LAP_TIME_REGEX.test(editLapTime.trim())) {
      setError('Lap time must be mm:ss.xxx (e.g. 1:23.456)');
      return;
    }
    try {
      await updateLap(editingLapId, {
        driver_name: editDriver.trim(),
        lap_time: editLapTime.trim(),
      });
      showSuccess('Lap updated');
      cancelEditLap();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update lap');
    }
  };

  const handleDeleteLap = async (id: number) => {
    if (!confirm('Delete this lap time?')) return;
    try {
      await deleteLap(id);
      showSuccess('Lap deleted');
      if (editingLapId === id) cancelEditLap();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete lap');
    }
  };

  const setDashboardTrackInSlot = (slotIndex: number, value: string) => {
    setDashboardTrackIds((prev) => {
      const next = [...prev];
      next[slotIndex] = value;
      if (value && next.length < MAX_DASHBOARD_TRACKS && !next.includes('')) {
        next.push('');
      }
      return next;
    });
  };

  const addDashboardTrackSlot = () => {
    if (dashboardTrackIds.length >= MAX_DASHBOARD_TRACKS) return;
    setDashboardTrackIds((prev) => [...prev, '']);
  };

  const removeDashboardTrackSlot = (slotIndex: number) => {
    setDashboardTrackIds((prev) => {
      const next = prev.filter((_, i) => i !== slotIndex);
      if (next.length > 0 && next.every(Boolean) && next.length < MAX_DASHBOARD_TRACKS) {
        return [...next, ''];
      }
      return next;
    });
  };

  const handleSaveDashboardTracks = async () => {
    const ids = dashboardTrackIds.filter(Boolean).map(Number);
    try {
      await setDashboardTracks(ids);
      showSuccess('Dashboard tracks saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save dashboard tracks');
    }
  };

  const handleSaveDashboardTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = dashboardTitle.trim() || 'F1 TIMING';
    try {
      await setDashboardTitle(title);
      setDashboardTitleState(title);
      showSuccess('Dashboard headline saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save headline');
    }
  };

  const handleSetDashboardUp = async (up: boolean) => {
    try {
      await setDashboardUp(up);
      setDashboardUpState(up);
      showSuccess(up ? 'Dashboard is now UP' : 'Dashboard is now DOWN — fullscreen status will show.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set dashboard status');
    }
  };

  const handleTrackOutlineUpload = async (trackId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.png')) {
      setError('Please upload a PNG image');
      e.target.value = '';
      return;
    }
    setTrackOutlineUploadingId(trackId);
    setError(null);
    e.target.value = '';
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          if (result.startsWith('data:')) resolve(result);
          else reject(new Error('Invalid file read'));
        };
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsDataURL(file);
      });
      await uploadTrackOutline(trackId, base64);
      setTrackOutlineTrackIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
      showSuccess('Track outline uploaded. It will show as background when this track is the only one selected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTrackOutlineUploadingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const backup = await exportDatabase();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `f1-timing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Database exported');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    e.target.value = '';
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as DatabaseBackup;
      if (!backup.tracks || !Array.isArray(backup.tracks) || !backup.laps || !Array.isArray(backup.laps)) {
        throw new Error('Invalid backup file');
      }
      await importDatabase(backup);
      showSuccess('Database imported');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-f1-dark p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
        <Link
          href="/"
          className="font-display text-xl md:text-2xl font-bold text-white hover:text-f1-red transition-colors"
        >
          F1 TIMING
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/drivers"
            className="text-sm text-f1-muted hover:text-f1-text transition-colors"
          >
            Drivers
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-f1-muted hover:text-f1-text transition-colors"
          >
            ← Dashboard
          </Link>
          {apiBase && (
            <span className="text-xs text-f1-muted font-mono" title="API base URL (for checking network access)">
              API: {apiBase.replace(/\/api\/?$/, '')}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            DASHBOARD HEADLINE
          </h2>
          <p className="text-f1-muted text-sm mb-4">
            The main title shown on the dashboard (e.g. F1 TIMING). Save to apply.
          </p>
          <form onSubmit={handleSaveDashboardTitle} className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={dashboardTitle}
              onChange={(e) => setDashboardTitleState(e.target.value)}
              placeholder="F1 TIMING"
              className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[200px]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Save headline
            </button>
          </form>
        </section>

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            DASHBOARD STATUS
          </h2>
          <p className="text-f1-muted text-sm mb-4">
            When the dashboard is DOWN, visitors see the fullscreen status (TIME, DATE, STATUS ERROR) instead of lap times.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-white font-medium">
              Dashboard is {dashboardUp ? 'UP' : 'DOWN'}
            </span>
            <button
              type="button"
              onClick={() => handleSetDashboardUp(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${dashboardUp ? 'bg-green-600 text-white' : 'border border-f1-border text-f1-muted hover:text-white'}`}
            >
              Set UP
            </button>
            <button
              type="button"
              onClick={() => handleSetDashboardUp(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${!dashboardUp ? 'bg-amber-600 text-white' : 'border border-f1-border text-f1-muted hover:text-white'}`}
            >
              Set DOWN
            </button>
          </div>
        </section>

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            DASHBOARD TRACK SELECTION
          </h2>
          <p className="text-f1-muted text-sm mb-4">
            Choose which tracks appear on the dashboard. Save to apply.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {dashboardTrackIds.map((trackId, slotIndex) => {
              const selectedInOtherSlots = dashboardTrackIds.filter(
                (id, i) => i !== slotIndex && id
              );
              const availableTracks = trackId
                ? tracks.filter(
                    (t) =>
                      String(t.id) === trackId ||
                      !selectedInOtherSlots.includes(String(t.id))
                  )
                : tracks.filter((t) => !dashboardTrackIds.filter(Boolean).includes(String(t.id)));
              return trackId ? (
                <div key={`${slotIndex}-${trackId}`} className="flex items-center gap-2">
                  <select
                    value={trackId}
                    onChange={(e) => setDashboardTrackInSlot(slotIndex, e.target.value)}
                    className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[180px]"
                  >
                    <option value="">Select track</option>
                    {availableTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.country}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeDashboardTrackSlot(slotIndex)}
                    className="text-red-400 hover:text-red-300 text-sm"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div key={`add-${slotIndex}`} className="flex items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => setDashboardTrackInSlot(slotIndex, e.target.value)}
                    className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[180px]"
                  >
                    <option value="">Select track</option>
                    {availableTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.country}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {dashboardTrackIds.length < MAX_DASHBOARD_TRACKS && dashboardTrackIds.every(Boolean) && (
              <button
                type="button"
                onClick={addDashboardTrackSlot}
                className="px-3 py-2 border border-dashed border-f1-border rounded-lg text-f1-muted hover:text-white text-sm"
              >
                + Add track
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveDashboardTracks}
              className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Save
            </button>
          </div>
        </section>

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            FULLSCREEN TRACK OUTLINE
          </h2>
          <p className="text-f1-muted text-sm mb-4">
            When only one track is selected on the dashboard, it is shown fullscreen. Upload a PNG (track outline or map) per track to use as the background for that track.
          </p>
          {loading ? (
            <p className="text-f1-muted text-sm">Loading...</p>
          ) : tracks.length === 0 ? (
            <p className="text-f1-muted text-sm">Add tracks first, then upload outlines.</p>
          ) : (
            <ul className="space-y-3">
              {tracks.map((track) => {
                const hasOutline = trackOutlineTrackIds.includes(track.id);
                const uploading = trackOutlineUploadingId === track.id;
                return (
                  <li
                    key={track.id}
                    className="flex items-center justify-between gap-4 py-2 border-b border-f1-border last:border-0"
                  >
                    <span className="text-white">
                      {track.name}
                      <span className="text-f1-muted text-sm ml-2">({track.country})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {hasOutline && (
                        <span className="text-green-400/90 text-xs">Uploaded</span>
                      )}
                      <label className="inline-block px-3 py-1.5 border border-f1-border rounded-lg text-white text-sm font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
                        <input
                          type="file"
                          accept=".png,image/png"
                          onChange={(ev) => handleTrackOutlineUpload(track.id, ev)}
                          disabled={trackOutlineUploadingId !== null}
                          className="hidden"
                        />
                        {uploading ? 'Uploading…' : hasOutline ? 'Replace' : 'Upload PNG'}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            TRACKS
          </h2>
          <form onSubmit={handleCreateTrack} className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              placeholder="Track name"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[140px]"
            />
            <input
              type="text"
              placeholder="Country"
              value={newTrackCountry}
              onChange={(e) => setNewTrackCountry(e.target.value)}
              className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Add track
            </button>
          </form>
          {loading ? (
            <p className="text-f1-muted text-sm">Loading...</p>
          ) : tracks.length === 0 ? (
            <p className="text-f1-muted text-sm">No tracks yet. Add one above.</p>
          ) : (
            <ul className="space-y-2">
              {tracks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b border-f1-border last:border-0"
                >
                  <span className="text-white">
                    {t.name} <span className="text-f1-muted">({t.country})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrack(t.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            ADD LAP TIME
          </h2>
          <p className="text-f1-muted text-xs mb-4">
            Format: mm:ss.xxx (e.g. 1:23.456)
          </p>
          <form onSubmit={handleCreateLap} className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              placeholder="Driver name"
              value={newLapDriver}
              onChange={(e) => setNewLapDriver(e.target.value)}
              className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[140px]"
            />
            <input
              type="text"
              placeholder="1:23.456"
              value={newLapTime}
              onChange={(e) => setNewLapTime(e.target.value)}
              className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white font-mono placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red w-[120px]"
            />
            <select
              value={newLapTrackId}
              onChange={(e) => setNewLapTrackId(e.target.value)}
              className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[160px]"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Add lap
            </button>
          </form>
        </section>

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            LAP TIMES
          </h2>
          {loading ? (
            <p className="text-f1-muted text-sm">Loading...</p>
          ) : laps.length === 0 ? (
            <p className="text-f1-muted text-sm">No lap times yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-f1-muted border-b border-f1-border">
                    <th className="py-2 pr-4">Driver</th>
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
                        <>
                          <td className="py-2 pr-4" colSpan={4}>
                            <form
                              onSubmit={handleSaveLap}
                              className="flex flex-wrap items-center gap-3 py-2"
                            >
                              <input
                                type="text"
                                value={editDriver}
                                onChange={(e) => setEditDriver(e.target.value)}
                                placeholder="Driver"
                                className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white text-sm min-w-[120px] focus:outline-none focus:ring-2 focus:ring-f1-red"
                              />
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
                                onClick={cancelEditLap}
                                className="px-3 py-1.5 border border-f1-border text-f1-muted text-sm rounded-lg hover:text-white"
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 pr-4 text-white">
                            {lap.driver_name}
                          </td>
                          <td className="py-3 pr-4 font-mono text-white">
                            {lap.lap_time}
                          </td>
                          <td className="py-3 pr-4 text-f1-muted">
                            {lap.track_name || '-'}
                          </td>
                          <td className="py-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditLap(lap)}
                              className="text-amber-400 hover:text-amber-300 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLap(lap.id)}
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

        <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            DATABASE BACKUP
          </h2>
          <p className="text-f1-muted text-sm mb-4">
            Export all tracks, lap times, and dashboard selection to a JSON file. Import replaces the current database with the backup.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export database'}
            </button>
            <label className="px-4 py-2 border border-f1-border rounded-lg text-white font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
              />
              {importing ? 'Importing…' : 'Import database'}
            </label>
          </div>
        </section>
      </div>
    </main>
  );
}
