'use client';

import { useEffect, useState, useMemo } from 'react';
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
  fetchCarouselInterval,
  setCarouselInterval,
  fetchUdpTelemetryConfig,
  setUdpTelemetryConfig,
  fetchUdpTelemetryDriverAlias,
  setUdpTelemetryDriverAlias,
  getTrackOutlineTrackIds,
  uploadTrackOutline,
  deleteTrackOutline,
  createTrack,
  updateTrack,
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

type AdminTab = 'dashboard' | 'telemetry' | 'tracks' | 'laps' | 'backup';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'laps', label: 'Laps' },
  { id: 'backup', label: 'Backup' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
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
  const [carouselIntervalSec, setCarouselIntervalSec] = useState<number>(10);
  const [trackOutlineTrackIds, setTrackOutlineTrackIds] = useState<number[]>([]);
  const [trackOutlineUploadingId, setTrackOutlineUploadingId] = useState<number | null>(null);
  const [trackOutlineInputKeys, setTrackOutlineInputKeys] = useState<Record<number, number>>({});
  const [trackOutlineDeletingId, setTrackOutlineDeletingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingLapId, setEditingLapId] = useState<number | null>(null);
  const [editDriver, setEditDriver] = useState('');
  const [editLapTime, setEditLapTime] = useState('');
  const [apiBase, setApiBase] = useState<string>('');
  const [udpBindAddress, setUdpBindAddress] = useState<string>('0.0.0.0');
  const [udpPort, setUdpPort] = useState<number>(20777);
  const [udpDriverAlias, setUdpDriverAlias] = useState<string>('');
  const [lapFilterTrackId, setLapFilterTrackId] = useState<string>('');
  const [lapFilterDriver, setLapFilterDriver] = useState('');
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editTrackName, setEditTrackName] = useState('');
  const [editTrackCountry, setEditTrackCountry] = useState('');

  const uniqueDriverNames = useMemo(() => {
    const set = new Set(laps.map((l) => l.driver_name).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [laps]);

  const filteredLaps = useMemo(() => {
    let list = [...laps];
    if (lapFilterTrackId) {
      const tid = Number(lapFilterTrackId);
      list = list.filter((l) => l.track_id === tid);
    }
    if (lapFilterDriver.trim()) {
      const q = lapFilterDriver.trim().toLowerCase();
      list = list.filter((l) => l.driver_name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (a.track_name !== b.track_name) return (a.track_name || '').localeCompare(b.track_name || '');
      return (a.lap_time || '').localeCompare(b.lap_time || '');
    });
    return list;
  }, [laps, lapFilterTrackId, lapFilterDriver]);

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
      const intervalMs = await fetchCarouselInterval().catch(() => 10000);
      setCarouselIntervalSec(Math.round(intervalMs / 1000));
      const outlineIds = await getTrackOutlineTrackIds().catch(() => []);
      setTrackOutlineTrackIds(outlineIds);
      const udp = await fetchUdpTelemetryConfig().catch(() => ({ bindAddress: '0.0.0.0', port: 20777 }));
      setUdpBindAddress(udp.bindAddress);
      setUdpPort(udp.port);
      const alias = await fetchUdpTelemetryDriverAlias().catch(() => '');
      setUdpDriverAlias(alias);
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
      if (editingTrackId === id) cancelEditTrack();
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

  const startEditTrack = (track: Track) => {
    setEditingTrackId(track.id);
    setEditTrackName(track.name);
    setEditTrackCountry(track.country);
  };

  const cancelEditTrack = () => {
    setEditingTrackId(null);
    setEditTrackName('');
    setEditTrackCountry('');
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTrackId == null) return;
    if (!editTrackName.trim() || !editTrackCountry.trim()) {
      setError('Name and country are required');
      return;
    }
    try {
      await updateTrack(editingTrackId, {
        name: editTrackName.trim(),
        country: editTrackCountry.trim(),
      });
      showSuccess('Track updated');
      cancelEditTrack();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update track');
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

  const setDashboardTrackShowAll = () => {
    const allIds = tracks.slice(0, MAX_DASHBOARD_TRACKS).map((t) => String(t.id));
    setDashboardTrackIds(allIds.length < MAX_DASHBOARD_TRACKS ? [...allIds, ''] : allIds);
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

  const handleSaveCarouselInterval = async (e: React.FormEvent) => {
    e.preventDefault();
    const sec = Math.max(3, Math.min(120, Math.round(Number(carouselIntervalSec) || 10)));
    try {
      await setCarouselInterval(sec * 1000);
      setCarouselIntervalSec(sec);
      showSuccess(`Carousel interval set to ${sec} seconds`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save carousel interval');
    }
  };

  const handleSaveUdpTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    const port = Math.max(1024, Math.min(65535, Math.round(Number(udpPort) || 20777)));
    try {
      await setUdpTelemetryConfig({ bindAddress: udpBindAddress.trim() || '0.0.0.0', port });
      setUdpPort(port);
      setUdpBindAddress(udpBindAddress.trim() || '0.0.0.0');
      showSuccess('UDP telemetry settings saved. Listener restarted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save UDP telemetry settings');
    }
  };

  const handleSaveUdpDriverAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const alias = await setUdpTelemetryDriverAlias(udpDriverAlias);
      setUdpDriverAlias(alias);
      showSuccess('Driver alias saved. Live view will show this name instead of the game name.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save driver alias');
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
      setTrackOutlineInputKeys((prev) => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + 1 }));
      showSuccess('Track outline uploaded. It will show as background when this track is the only one selected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setTrackOutlineUploadingId(null);
      e.target.value = '';
    }
  };

  const handleTrackOutlineDelete = async (trackId: number) => {
    if (!trackOutlineTrackIds.includes(trackId)) return;
    if (!confirm('Remove the track outline image for this track?')) return;
    setTrackOutlineDeletingId(trackId);
    setError(null);
    try {
      await deleteTrackOutline(trackId);
      setTrackOutlineTrackIds((prev) => prev.filter((id) => id !== trackId));
      showSuccess('Track outline removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete outline');
    } finally {
      setTrackOutlineDeletingId(null);
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
      <header className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <Link
          href="/"
          className="font-display text-xl md:text-2xl font-bold text-white hover:text-f1-red transition-colors"
        >
          F1 TIMING
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/admin/drivers" className="text-sm text-f1-muted hover:text-f1-text transition-colors">
            Drivers
          </Link>
          <Link href="/dashboard" className="text-sm text-f1-muted hover:text-f1-text transition-colors">
            ← Dashboard
          </Link>
          {apiBase && (
            <span className="text-xs text-f1-muted font-mono" title="API base URL">
              API: {apiBase.replace(/\/api\/?$/, '')}
            </span>
          )}
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-6 py-3 px-4 mb-6 rounded-xl bg-f1-panel/60 border border-f1-border">
        <span className="text-f1-muted text-sm">
          <strong className="text-white">{tracks.length}</strong> tracks
        </span>
        <span className="text-f1-muted text-sm">
          <strong className="text-white">{laps.length}</strong> lap times
        </span>
        <span className="text-f1-muted text-sm">
          Dashboard: <strong className={dashboardUp ? 'text-green-400' : 'text-amber-400'}>{dashboardUp ? 'UP' : 'DOWN'}</strong>
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 mb-6 border-b border-f1-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-f1-panel border border-f1-border border-b-0 text-white -mb-px'
                : 'text-f1-muted hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto space-y-6">
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

        {/* ——— Dashboard tab ——— */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">DASHBOARD HEADLINE</h2>
              <p className="text-f1-muted text-sm mb-4">Main title on the dashboard. Save to apply.</p>
              <form onSubmit={handleSaveDashboardTitle} className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={dashboardTitle}
                  onChange={(e) => setDashboardTitleState(e.target.value)}
                  placeholder="F1 TIMING"
                  className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[200px]"
                />
                <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
                  Save headline
                </button>
              </form>
            </section>

            <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">DASHBOARD STATUS</h2>
              <p className="text-f1-muted text-sm mb-4">When DOWN, visitors see fullscreen status (TIME, DATE, STATUS ERROR).</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-white font-medium">Dashboard is {dashboardUp ? 'UP' : 'DOWN'}</span>
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
              <h2 className="font-display text-lg font-semibold text-white mb-4">CAROUSEL INTERVAL</h2>
              <p className="text-f1-muted text-sm mb-4">Seconds per slide on Carousel page (3–120). Save to apply.</p>
              <form onSubmit={handleSaveCarouselInterval} className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={3}
                  max={120}
                  value={carouselIntervalSec}
                  onChange={(e) => setCarouselIntervalSec(Number(e.target.value) || 10)}
                  className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red w-24"
                />
                <span className="text-f1-muted text-sm">seconds per slide</span>
                <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
                  Save interval
                </button>
              </form>
            </section>

            <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">DASHBOARD TRACK SELECTION</h2>
              <p className="text-f1-muted text-sm mb-4">Choose which tracks appear on the dashboard. Save to apply.</p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {dashboardTrackIds.map((trackId, slotIndex) => {
                  const selectedInOtherSlots = dashboardTrackIds.filter((id, i) => i !== slotIndex && id);
                  const availableTracks = trackId
                    ? tracks.filter((t) => String(t.id) === trackId || !selectedInOtherSlots.includes(String(t.id)))
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
                          <option key={t.id} value={t.id}>{t.name} — {t.country}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeDashboardTrackSlot(slotIndex)} className="text-red-400 hover:text-red-300 text-sm" aria-label="Remove">✕</button>
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
                          <option key={t.id} value={t.id}>{t.name} — {t.country}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {dashboardTrackIds.length < MAX_DASHBOARD_TRACKS && dashboardTrackIds.every(Boolean) && (
                  <button type="button" onClick={addDashboardTrackSlot} className="px-3 py-2 border border-dashed border-f1-border rounded-lg text-f1-muted hover:text-white text-sm">
                    + Add track
                  </button>
                )}
                <button type="button" onClick={setDashboardTrackShowAll} disabled={tracks.length === 0} className="px-3 py-2 border border-f1-border rounded-lg text-f1-muted hover:text-white text-sm disabled:opacity-50">
                  Show all
                </button>
                <button type="button" onClick={handleSaveDashboardTracks} className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
                  Save
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ——— Telemetry tab ——— */}
        {activeTab === 'telemetry' && (
          <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-white mb-4">F1 25 UDP TELEMETRY</h2>
            <p className="text-f1-muted text-sm mb-4">
              IP and port the backend listens on. Set the same port in the game UDP settings (e.g. 20777). Bind 0.0.0.0 = all interfaces. Save restarts the listener.
            </p>
            <form onSubmit={handleSaveUdpTelemetry} className="flex flex-wrap items-center gap-3">
              <label className="text-f1-muted text-sm">
                Bind address
                <input type="text" value={udpBindAddress} onChange={(e) => setUdpBindAddress(e.target.value)} placeholder="0.0.0.0" className="ml-2 bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]" />
              </label>
              <label className="text-f1-muted text-sm">
                Port
                <input type="number" min={1024} max={65535} value={udpPort} onChange={(e) => setUdpPort(Number(e.target.value) || 20777)} className="ml-2 bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red w-24" />
              </label>
              <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Save & restart listener</button>
            </form>
            <div className="mt-6 pt-6 border-t border-f1-border">
              <p className="text-f1-muted text-sm mb-3">Display name in live telemetry view (overrides game name). Leave empty to use game name.</p>
              <form onSubmit={handleSaveUdpDriverAlias} className="flex flex-wrap items-center gap-3">
                <input type="text" value={udpDriverAlias} onChange={(e) => setUdpDriverAlias(e.target.value)} placeholder="e.g. Max, Player 1" className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[180px]" />
                <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Save alias</button>
              </form>
            </div>
          </section>
        )}

        {/* ——— Tracks tab ——— */}
        {activeTab === 'tracks' && (
          <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-white mb-4">TRACKS</h2>
            <p className="text-f1-muted text-sm mb-4">Add, edit, or delete tracks. Upload a PNG outline per track for fullscreen background when that track is the only one selected.</p>
            <form onSubmit={handleCreateTrack} className="flex flex-wrap gap-3 mb-6">
              <input type="text" placeholder="Track name" value={newTrackName} onChange={(e) => setNewTrackName(e.target.value)} className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[140px]" />
              <input type="text" placeholder="Country" value={newTrackCountry} onChange={(e) => setNewTrackCountry(e.target.value)} className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]" />
              <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Add track</button>
            </form>
            {loading ? (
              <p className="text-f1-muted text-sm">Loading...</p>
            ) : tracks.length === 0 ? (
              <p className="text-f1-muted text-sm">No tracks yet. Add one above.</p>
            ) : (
              <ul className="space-y-2">
                {tracks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-2 border-b border-f1-border last:border-0">
                    {editingTrackId === t.id ? (
                      <form onSubmit={handleSaveTrack} className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editTrackName}
                          onChange={(e) => setEditTrackName(e.target.value)}
                          placeholder="Track name"
                          className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]"
                        />
                        <input
                          type="text"
                          value={editTrackCountry}
                          onChange={(e) => setEditTrackCountry(e.target.value)}
                          placeholder="Country"
                          className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[100px]"
                        />
                        <button type="submit" className="px-2 py-1.5 bg-f1-red text-white text-sm font-medium rounded-lg hover:bg-red-600">Save</button>
                        <button type="button" onClick={cancelEditTrack} className="px-2 py-1.5 border border-f1-border text-f1-muted text-sm rounded-lg hover:text-white">Cancel</button>
                      </form>
                    ) : (
                      <>
                        <span className="text-white">{t.name} <span className="text-f1-muted">({t.country})</span></span>
                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          <span className="flex items-center gap-2 text-f1-muted">
                            {trackOutlineTrackIds.includes(t.id) ? (
                              <>
                                <span className="text-green-400/90 text-xs">Outline</span>
                                <label className="inline-block px-2 py-1 border border-f1-border rounded text-white text-xs font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
                                  <input
                                    key={`outline-${t.id}-${trackOutlineInputKeys[t.id] ?? 0}`}
                                    type="file"
                                    accept=".png,image/png"
                                    onChange={(ev) => handleTrackOutlineUpload(t.id, ev)}
                                    disabled={trackOutlineUploadingId !== null}
                                    className="hidden"
                                  />
                                  {trackOutlineUploadingId === t.id ? 'Uploading…' : 'Replace'}
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleTrackOutlineDelete(t.id)}
                                  disabled={trackOutlineDeletingId !== null}
                                  className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                                >
                                  {trackOutlineDeletingId === t.id ? 'Deleting…' : 'Delete PNG'}
                                </button>
                              </>
                            ) : (
                              <label className="inline-block px-2 py-1 border border-f1-border rounded text-white text-xs font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
                                <input
                                  key={`outline-${t.id}-${trackOutlineInputKeys[t.id] ?? 0}`}
                                  type="file"
                                  accept=".png,image/png"
                                  onChange={(ev) => handleTrackOutlineUpload(t.id, ev)}
                                  disabled={trackOutlineUploadingId !== null}
                                  className="hidden"
                                />
                                {trackOutlineUploadingId === t.id ? 'Uploading…' : 'Upload PNG'}
                              </label>
                            )}
                          </span>
                          <span className="text-f1-border">|</span>
                          <span className="flex items-center gap-2">
                            <button type="button" onClick={() => startEditTrack(t)} className="text-amber-400 hover:text-amber-300 text-sm">Edit</button>
                            <button type="button" onClick={() => handleDeleteTrack(t.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                          </span>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ——— Laps tab ——— */}
        {activeTab === 'laps' && (
          <div className="space-y-6">
            <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">ADD LAP TIME</h2>
              <p className="text-f1-muted text-xs mb-4">Format: mm:ss.xxx (e.g. 1:23.456). Driver: type or pick from existing.</p>
              <form onSubmit={handleCreateLap} className="flex flex-wrap gap-3 mb-6">
                <span className="relative flex-1 min-w-[140px] max-w-[200px]">
                  <input
                    type="text"
                    list="driver-suggestions"
                    placeholder="Driver name"
                    value={newLapDriver}
                    onChange={(e) => setNewLapDriver(e.target.value)}
                    className="w-full bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red"
                  />
                  <datalist id="driver-suggestions">
                    {uniqueDriverNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </span>
                <input type="text" placeholder="1:23.456" value={newLapTime} onChange={(e) => setNewLapTime(e.target.value)} className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white font-mono placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red w-[120px]" />
                <select value={newLapTrackId} onChange={(e) => setNewLapTrackId(e.target.value)} className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[160px]">
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Add lap</button>
              </form>
            </section>

            <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">LAP TIMES</h2>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                  value={lapFilterTrackId}
                  onChange={(e) => setLapFilterTrackId(e.target.value)}
                  className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[160px]"
                >
                  <option value="">All tracks</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Filter by driver…"
                  value={lapFilterDriver}
                  onChange={(e) => setLapFilterDriver(e.target.value)}
                  className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white text-sm placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[140px]"
                />
                <span className="text-f1-muted text-sm">Showing {filteredLaps.length} of {laps.length}</span>
              </div>
              {loading ? (
                <p className="text-f1-muted text-sm">Loading...</p>
              ) : laps.length === 0 ? (
                <p className="text-f1-muted text-sm">No lap times yet. Add one above.</p>
              ) : (
                <>
                  <datalist id="edit-driver-suggestions">
                    {uniqueDriverNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-f1-muted border-b border-f1-border">
                        <th className="py-2 pr-4">Driver</th>
                        <th className="py-2 pr-4 font-mono">Lap time</th>
                        <th className="py-2 pr-4">Track</th>
                        <th className="py-2 w-36 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLaps.map((lap) => (
                        <tr key={lap.id} className="border-b border-f1-border last:border-0 group">
                          {editingLapId === lap.id ? (
                            <>
                              <td className="py-1.5 pr-4" colSpan={4}>
                                <form onSubmit={handleSaveLap} className="flex flex-wrap items-center gap-3 py-1">
                                  <input
                                    type="text"
                                    list="edit-driver-suggestions"
                                    value={editDriver}
                                    onChange={(e) => setEditDriver(e.target.value)}
                                    placeholder="Driver"
                                    className="min-w-[100px] bg-f1-dark border border-f1-border rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red"
                                  />
                                  <input
                                    type="text"
                                    value={editLapTime}
                                    onChange={(e) => setEditLapTime(e.target.value)}
                                    placeholder="1:23.456"
                                    className="min-w-[90px] bg-f1-dark border border-f1-border rounded px-2 py-1.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-f1-red"
                                  />
                                  <span className="text-f1-muted text-sm">{lap.track_name || '-'}</span>
                                  <button type="submit" className="px-2 py-1 bg-f1-red text-white text-xs font-medium rounded hover:bg-red-600">Save</button>
                                  <button type="button" onClick={cancelEditLap} className="px-2 py-1 border border-f1-border text-f1-muted text-xs rounded hover:text-white">Cancel</button>
                                </form>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5 pr-4 text-white">{lap.driver_name}</td>
                              <td className="py-2.5 pr-4 font-mono text-white">{lap.lap_time}</td>
                              <td className="py-2.5 pr-4 text-f1-muted">{lap.track_name || '-'}</td>
                              <td className="py-2.5 text-right">
                                <button type="button" onClick={() => startEditLap(lap)} className="text-amber-400 hover:text-amber-300 text-sm mr-2">Edit</button>
                                <button type="button" onClick={() => handleDeleteLap(lap.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ——— Backup tab ——— */}
        {activeTab === 'backup' && (
          <section className="bg-f1-panel border border-f1-border rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-white mb-4">DATABASE BACKUP</h2>
            <p className="text-f1-muted text-sm mb-4">
              Export all tracks, lap times, and dashboard selection to JSON. Import replaces the current database.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={handleExport} disabled={exporting} className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
                {exporting ? 'Exporting…' : 'Export database'}
              </button>
              <label className="px-4 py-2 border border-f1-border rounded-lg text-white font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
                <input type="file" accept=".json,application/json" onChange={handleImport} disabled={importing} className="hidden" />
                {importing ? 'Importing…' : 'Import database'}
              </label>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
