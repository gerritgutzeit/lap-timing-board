'use client';

import { useEffect, useState, useMemo } from 'react';
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
  fetchDisplayView,
  setDisplayView,
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
  type DisplayView,
} from '@/lib/api';
import { MAX_DASHBOARD_TRACKS, LAP_TIME_REGEX } from '../constants';

export function useAdminData() {
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
  const [displayView, setDisplayViewState] = useState<DisplayView>('dashboard');
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
      const view = await fetchDisplayView().catch(() => 'dashboard');
      setDisplayViewState(view);
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

  const setDashboardTrackHideAll = () => {
    setDashboardTrackIds(['']);
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

  const handleSetDisplayView = async (view: DisplayView) => {
    try {
      await setDisplayView(view);
      setDisplayViewState(view);
      showSuccess(`Display view set to ${view === 'carousel' ? 'Carousel' : 'Dashboard'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save display view');
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

  return {
    // Shared
    tracks,
    laps,
    loading,
    error,
    success,
    apiBase,
    load,

    // Dashboard tab
    dashboardTrackIds,
    dashboardTitle,
    setDashboardTitleState,
    dashboardUp,
    carouselIntervalSec,
    setCarouselIntervalSec,
    displayView,
    setDashboardTrackInSlot,
    addDashboardTrackSlot,
    setDashboardTrackShowAll,
    setDashboardTrackHideAll,
    removeDashboardTrackSlot,
    handleSaveDashboardTracks,
    handleSaveDashboardTitle,
    handleSetDashboardUp,
    handleSaveCarouselInterval,
    handleSetDisplayView,

    // Telemetry tab
    udpBindAddress,
    setUdpBindAddress,
    udpPort,
    setUdpPort,
    udpDriverAlias,
    setUdpDriverAlias,
    handleSaveUdpTelemetry,
    handleSaveUdpDriverAlias,

    // Tracks tab
    newTrackName,
    setNewTrackName,
    newTrackCountry,
    setNewTrackCountry,
    trackOutlineTrackIds,
    trackOutlineUploadingId,
    trackOutlineInputKeys,
    trackOutlineDeletingId,
    editingTrackId,
    editTrackName,
    setEditTrackName,
    editTrackCountry,
    setEditTrackCountry,
    handleCreateTrack,
    handleDeleteTrack,
    startEditTrack,
    cancelEditTrack,
    handleSaveTrack,
    handleTrackOutlineUpload,
    handleTrackOutlineDelete,

    // Laps tab
    newLapDriver,
    setNewLapDriver,
    newLapTime,
    setNewLapTime,
    newLapTrackId,
    setNewLapTrackId,
    lapFilterTrackId,
    setLapFilterTrackId,
    lapFilterDriver,
    setLapFilterDriver,
    uniqueDriverNames,
    filteredLaps,
    editingLapId,
    editDriver,
    setEditDriver,
    editLapTime,
    setEditLapTime,
    handleCreateLap,
    startEditLap,
    cancelEditLap,
    handleSaveLap,
    handleDeleteLap,

    // Backup tab
    importing,
    exporting,
    handleExport,
    handleImport,
  };
}
