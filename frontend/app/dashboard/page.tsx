'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { fetchTracks, fetchFastestLaps, fetchDashboardTracks, fetchDashboardTitle, fetchDashboardUp, fetchTelemetryLive, fetchFastestLapByTrackName, type Track, type Lap, type TelemetryLiveState, type FastestLapByTrackName } from '@/lib/api';
import { getTrackOutlineImageUrl, getTrackOutlineTrackIds, hasTrackOutline } from '@/lib/api';
import CountryFlag from '@/components/CountryFlag';

/** Format lap time from milliseconds to fixed-width MM:SS.hh (e.g. 01:32.84) so digits don't jump. */
function formatLapTimeFromMs(ms: number): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '——:——.—';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((seconds % 1) * 100);
  const secs = Math.floor(seconds);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

const REFRESH_MS = 5000;

/** Parse "m:ss.xxx" to seconds. */
function lapTimeToSeconds(lapTime: string): number {
  const match = lapTime.trim().match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, m, s, ms] = match;
  return (parseInt(m!, 10) * 60) + parseInt(s!, 10) + parseInt(ms!, 10) / 1000;
}

/** Format delta in seconds as +X.XXXs (or empty for 0). */
function formatDelta(seconds: number): string {
  if (seconds <= 0) return '';
  return `+${seconds.toFixed(3)}s`;
}

/** Delta of last lap vs record: negative = faster (green), positive = slower (red). Returns null if can't compute. */
function lastLapDeltaVsRecord(lastLapMs: number | null | undefined, recordLapTime: string | undefined): number | null {
  if (lastLapMs == null || lastLapMs <= 0 || !recordLapTime?.trim()) return null;
  const recordSeconds = lapTimeToSeconds(recordLapTime);
  if (recordSeconds <= 0) return null;
  return lastLapMs / 1000 - recordSeconds;
}

function formatDeltaSigned(seconds: number): string {
  if (seconds === 0) return '0.000s';
  if (seconds < 0) return `${seconds.toFixed(3)}s`;
  return `+${seconds.toFixed(3)}s`;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const now = useClock();
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [dashboardTrackIds, setDashboardTrackIds] = useState<number[]>([]);
  const [dashboardTitle, setDashboardTitleState] = useState<string>('F1 TIMING');
  const [dashboardUp, setDashboardUp] = useState(true);
  const [lapsByTrack, setLapsByTrack] = useState<Record<number, Lap[]>>({});
  const lapsByTrackRef = useRef<Record<number, Lap[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTrackOutlineImage, setHasTrackOutlineImage] = useState(false);
  const [trackIdsWithOutline, setTrackIdsWithOutline] = useState<number[]>([]);
  const [showContentRecovered, setShowContentRecovered] = useState(false);
  const prevShowFullscreenStatusRef = useRef<boolean>(false);
  const [telemetry, setTelemetry] = useState<TelemetryLiveState | null>(null);
  const [fastestDbLap, setFastestDbLap] = useState<FastestLapByTrackName | null>(null);
  const prevLastLapTimeMsRef = useRef<number | null>(null);
  const [lastLapFullscreen, setLastLapFullscreen] = useState<{ lastLapTimeMs: number } | null>(null);
  const [newRecordFullscreen, setNewRecordFullscreen] = useState<{ lastLapTimeMs: number } | null>(null);

  useEffect(() => {
    lapsByTrackRef.current = lapsByTrack;
  }, [lapsByTrack]);

  // When last lap time updates: fullscreen "new record" (10s) if faster than record, else "last lap + delta" (4s)
  useEffect(() => {
    const ms = telemetry?.lastLapTimeMs;
    if (ms == null || ms <= 0) return;
    if (prevLastLapTimeMsRef.current === ms) return;
    prevLastLapTimeMsRef.current = ms;
    const delta = lastLapDeltaVsRecord(ms, fastestDbLap?.fastest?.lapTime);
    if (delta != null && delta < 0) {
      setNewRecordFullscreen({ lastLapTimeMs: ms });
      setLastLapFullscreen(null);
      const t = setTimeout(() => setNewRecordFullscreen(null), 10000);
      return () => clearTimeout(t);
    }
    setLastLapFullscreen({ lastLapTimeMs: ms });
    setNewRecordFullscreen(null);
    const t = setTimeout(() => setLastLapFullscreen(null), 4000);
    return () => clearTimeout(t);
  // Only depend on lastLapTimeMs so the timeout is not cleared when fastestDbLap loads
  }, [telemetry?.lastLapTimeMs]);

  // When live view shows a track, fetch fastest lap from DB for comparison
  useEffect(() => {
    if (!telemetry?.trackName?.trim()) {
      setFastestDbLap(null);
      return;
    }
    let cancelled = false;
    fetchFastestLapByTrackName(telemetry.trackName)
      .then((data) => { if (!cancelled) setFastestDbLap(data ?? null); })
      .catch(() => { if (!cancelled) setFastestDbLap(null); });
    return () => { cancelled = true; };
  }, [telemetry?.trackName]);

  // Poll F1 25 UDP telemetry when on dashboard; treat as "hot" only if recent data
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const state = await fetchTelemetryLive();
        if (!cancelled) setTelemetry(state);
      } catch {
        if (!cancelled) setTelemetry(null);
      }
    };
    poll();
    const interval = setInterval(poll, 150);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadTracks = async () => {
    try {
      const data = await fetchTracks();
      setTracks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch tracks');
    }
  };

  const loadDashboardConfig = async () => {
    try {
      const [ids, title, up] = await Promise.all([
        fetchDashboardTracks(),
        fetchDashboardTitle().catch(() => 'F1 TIMING'),
        fetchDashboardUp().catch(() => true),
      ]);
      setDashboardTrackIds(ids);
      setDashboardTitleState(title || 'F1 TIMING');
      setDashboardUp(up);
      setError(null);
    } catch {
      setDashboardTrackIds([]);
      setError('Backend unreachable');
    }
  };

  const loadLapsForTracks = async (
    trackIds: number[],
    isBackgroundRefresh?: boolean
  ) => {
    if (trackIds.length === 0) {
      setLapsByTrack({});
      setLoading(false);
      return;
    }
    // Only show loading on initial load; background refresh keeps current UI to avoid flicker
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    setError(null);
    try {
      const results = await Promise.all(
        trackIds.map(async (id) => {
          const laps = await fetchFastestLaps(id);
          return { id, laps };
        })
      );
      const map: Record<number, Lap[]> = {};
      results.forEach(({ id, laps }) => {
        map[id] = laps;
      });
      setLapsByTrack(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load laps');
      setLapsByTrack({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
    loadDashboardConfig();
  }, []);

  useEffect(() => {
    loadLapsForTracks(dashboardTrackIds);
  }, [dashboardTrackIds.join(',')]);

  // Live refresh: re-fetch dashboard track selection and lap timings every REFRESH_MS
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardConfig();
      if (dashboardTrackIds.length > 0) {
        const current = lapsByTrackRef.current;
        const hasData = dashboardTrackIds.some(
          (id) => (current[id]?.length ?? 0) > 0
        );
        loadLapsForTracks(dashboardTrackIds, hasData);
      }
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [dashboardTrackIds.join(',')]);

  const selectedTracks = useMemo(() => {
    return dashboardTrackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter(Boolean) as Track[];
  }, [tracks, dashboardTrackIds]);

  const isSingleTrackFullscreen = selectedTracks.length === 1;
  const singleTrack = isSingleTrackFullscreen ? selectedTracks[0]! : null;
  const singleTrackLaps = singleTrack ? (lapsByTrack[singleTrack.id] ?? []) : [];
  const fastestSeconds = singleTrackLaps.length > 0 ? lapTimeToSeconds(singleTrackLaps[0].lap_time) : 0;
  const trackOutlineUrl = singleTrack ? getTrackOutlineImageUrl(singleTrack.id) : '';

  useEffect(() => {
    if (!singleTrack) {
      setHasTrackOutlineImage(false);
      return;
    }
    hasTrackOutline(singleTrack.id).then(setHasTrackOutlineImage).catch(() => setHasTrackOutlineImage(false));
  }, [singleTrack?.id]);

  useEffect(() => {
    if (dashboardTrackIds.length <= 1) return;
    getTrackOutlineTrackIds().then(setTrackIdsWithOutline).catch(() => setTrackIdsWithOutline([]));
  }, [dashboardTrackIds.join(',')]);

  // Time/date only after mount to avoid hydration mismatch (server vs client second differs)
  const timeStr = mounted ? now.toTimeString().slice(0, 8).replace(/:/g, ' ') : '— — —';
  const dateStr = mounted ? now.toISOString().slice(0, 10).replace(/-/g, ' ') : '— — — — —';

  const backendUnreachable = !!error;
  const showFullscreenStatus = backendUnreachable || !dashboardUp;
  const showLiveLapView = !!telemetry?.isHot && (telemetry?.currentLapTimeMs != null && telemetry.currentLapTimeMs > 0);

  useEffect(() => {
    const wasFullscreen = prevShowFullscreenStatusRef.current;
    prevShowFullscreenStatusRef.current = showFullscreenStatus;
    if (wasFullscreen && !showFullscreenStatus) {
      setShowContentRecovered(true);
      const t = setTimeout(() => setShowContentRecovered(false), 1200);
      return () => clearTimeout(t);
    }
  }, [showFullscreenStatus]);

  return (
    <main
      className={`min-h-screen text-techie-text font-mono text-sm antialiased transition-colors duration-500 ${showLiveLapView ? 'bg-techie-bg' : showFullscreenStatus ? 'bg-techie-bg' : !isSingleTrackFullscreen ? 'bg-techie-bg dashboard-grid' : ''}`}
    >
      <header className={`flex items-center justify-between px-6 md:px-10 py-6 relative z-10 transition-opacity duration-500 ${showFullscreenStatus && !showLiveLapView ? 'opacity-80' : ''}`}>
        <Link
          href="/"
          className="font-display font-semibold text-techie-text hover:text-techie-accent transition-colors tracking-[0.25em] text-2xl md:text-3xl lg:text-4xl uppercase"
        >
          {showLiveLapView ? 'LIVE LAP' : isSingleTrackFullscreen && singleTrack ? singleTrack.name : dashboardTitle}
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/carousel" className="text-sm text-techie-dim hover:text-techie-text transition-colors">
            Carousel
          </Link>
          <Link href="/drivers" className="text-sm text-techie-dim hover:text-techie-text transition-colors">
            Drivers
          </Link>
        </div>
      </header>

      {/* Fullscreen: new record – time only, solid background, 10s */}
      {showLiveLapView && newRecordFullscreen && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-techie-bg px-6 animate-last-lap-fullscreen-in" aria-live="polite" role="status">
          <p className="font-display font-black text-2xl sm:text-3xl uppercase tracking-[0.2em] text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)] mb-6">
            New record
          </p>
          <p className="font-mono font-bold text-techie-text text-7xl sm:text-8xl md:text-9xl tracking-tight tabular-nums text-center">
            {formatLapTimeFromMs(newRecordFullscreen.lastLapTimeMs)}
          </p>
        </div>
      )}

      {/* Fullscreen: new lap time + delta (if slower) only, centered – hides live view underneath */}
      {showLiveLapView && lastLapFullscreen && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-techie-bg px-6 animate-last-lap-fullscreen-in" aria-live="polite" role="status">
          <p className="font-mono font-bold text-techie-text text-7xl sm:text-8xl md:text-9xl tracking-tight tabular-nums text-center">
            {formatLapTimeFromMs(lastLapFullscreen.lastLapTimeMs)}
          </p>
          <div className="mt-6 min-h-[3.5rem] flex items-center justify-center">
            {(() => {
              const delta = lastLapDeltaVsRecord(lastLapFullscreen.lastLapTimeMs, fastestDbLap?.fastest?.lapTime);
              if (delta == null || delta <= 0) return null;
              return (
                <p className="text-red-400 font-mono text-2xl sm:text-3xl tabular-nums">
                  {formatDeltaSigned(delta)}
                </p>
              );
            })()}
          </div>
        </div>
      )}

      {/* Live F1 25 lap time when UDP telemetry is hot – hidden while any fullscreen overlay is showing */}
      {showLiveLapView && !lastLapFullscreen && !newRecordFullscreen && (() => {
        const lastLapDelta = lastLapDeltaVsRecord(telemetry?.lastLapTimeMs, fastestDbLap?.fastest?.lapTime);
        return (
        <div className="telemetry-view px-6 bg-techie-bg">
          <div className="relative z-10 w-full max-w-xl flex flex-col items-center justify-center opacity-0 animate-telemetry-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-f1-red/40 bg-f1-red/10 mb-4 animate-telemetry-live-pulse">
              <span className="w-2 h-2 rounded-full bg-f1-red animate-pulse shadow-[0_0_8px_rgba(225,6,0,0.8)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-f1-red">Live</span>
            </div>
            {telemetry?.trackName && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4 text-techie-dim">
                <span className="text-xl sm:text-2xl font-semibold uppercase tracking-wider text-techie-text">{telemetry.trackName}</span>
              </div>
            )}
            <div className="telemetry-card w-full">
              <p className="text-techie-dim text-xs uppercase tracking-[0.25em] mb-5">Current lap</p>
              <div className="w-full flex justify-center">
                <p
                  className="telemetry-time-block font-mono font-bold text-techie-text text-6xl sm:text-7xl md:text-8xl tracking-tight animate-telemetry-time-in animate-telemetry-glow"
                  aria-live="polite"
                >
                  {formatLapTimeFromMs(telemetry!.currentLapTimeMs!)}
                </p>
              </div>
            </div>
            <p className="text-techie-dim text-sm mt-5 font-mono tabular-nums opacity-0 animate-telemetry-time-in" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              Last lap <span className="inline-block w-[8ch] text-center">{telemetry?.lastLapTimeMs != null && telemetry.lastLapTimeMs > 0 ? formatLapTimeFromMs(telemetry.lastLapTimeMs) : '—:—.—'}</span>
              {lastLapDelta != null && (
                <span
                  className={`ml-2 text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${lastLapDelta < 0 ? 'text-green-400 bg-green-500/15' : 'text-red-400 bg-red-500/15'}`}
                  title={lastLapDelta < 0 ? 'Faster than record' : 'Slower than record'}
                >
                  {formatDeltaSigned(lastLapDelta)}
                </span>
              )}
            </p>
            <p className="text-techie-dim text-sm mt-2 font-mono tabular-nums opacity-0 animate-telemetry-time-in" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              Record <span className="inline-block w-[8ch] text-center text-techie-accent">{fastestDbLap?.fastest ? fastestDbLap.fastest.lapTime : '—:—.—'}</span>
              {fastestDbLap?.fastest?.driverName && <span className="ml-2 text-techie-dim">({fastestDbLap.fastest.driverName})</span>}
            </p>
            {telemetry?.driverName && (
              <p className="text-techie-dim text-sm mt-auto pt-6 opacity-0 animate-telemetry-time-in" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
                Current Driver: <span className="font-medium text-techie-accent">{telemetry.driverName}</span>
              </p>
            )}
          </div>
        </div>
        );
      })()}

      {/* Fullscreen status when backend is unreachable or dashboard is set to down (not when live lap is showing) */}
      {!showLiveLapView && showFullscreenStatus && (
        <div
          className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 py-12 animate-status-in"
          aria-live="polite"
          role="status"
        >
          <div className="bg-techie-surface/95 backdrop-blur-sm rounded-lg border border-white/10 px-8 py-10 md:px-12 md:py-14 text-center shadow-2xl max-w-md w-full">
            <div className="space-y-6">
              <div>
                <p className="text-techie-dim text-sm uppercase tracking-widest mb-2">TIME</p>
                <p className="techie-embed font-mono font-semibold text-techie-text text-3xl md:text-4xl tabular-nums tracking-wider">
                  {timeStr}
                </p>
              </div>
              <div>
                <p className="text-techie-dim text-sm uppercase tracking-widest mb-2">DATE</p>
                <p className="techie-embed font-mono font-semibold text-techie-text text-3xl md:text-4xl tabular-nums tracking-wider">
                  {dateStr}
                </p>
              </div>
              <div>
                <p className="text-techie-dim text-sm uppercase tracking-widest mb-2">STATUS</p>
                <p className="techie-embed font-mono font-semibold text-techie-accent text-2xl md:text-3xl tracking-wider animate-waiting-pulse">
                  Waiting for data…
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && !backendUnreachable && !showLiveLapView && (
        <div className="relative z-10 px-6 md:px-10">
          <div className="bg-red-950/30 px-5 py-3 rounded-sm text-red-400 text-xs max-w-6xl mx-auto">
            {error}
          </div>
        </div>
      )}

      {!showLiveLapView && !showFullscreenStatus && isSingleTrackFullscreen ? (
        /* Fullscreen single-track view – track outline as background when uploaded */
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 pointer-events-none"
          style={{ zIndex: 0 }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-techie-bg" />
          {hasTrackOutlineImage && (
            <div
              className="absolute top-0 right-0 w-[40%] max-w-[400px] h-[40%] max-h-[400px] mt-6 mr-6"
              style={{
                backgroundImage: `url(${trackOutlineUrl})`,
                backgroundSize: 'contain',
                backgroundPosition: '100% 0%',
                backgroundRepeat: 'no-repeat',
                filter: 'brightness(0) invert(1)',
                opacity: 0.55,
              }}
            />
          )}
        </div>
      ) : null}

{!showLiveLapView && (
      <div
        className={`relative z-10 ${showContentRecovered ? 'animate-content-in' : ''} ${isSingleTrackFullscreen ? 'px-6 md:px-10 pb-24 min-h-[60vh] flex flex-col' : 'px-6 md:px-12 lg:px-16 pb-24 flex flex-col min-h-[calc(100vh-7rem)] justify-center'}`}
      >
        {!showFullscreenStatus && isSingleTrackFullscreen && singleTrack ? (
          /* Single track fullscreen content */
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-techie-dim text-sm uppercase tracking-widest">
                {singleTrack.name}
              </span>
              <CountryFlag country={singleTrack.country} />
            </div>
            {loading ? (
              <div className="text-techie-dim py-8 animate-fade-in">LOADING...</div>
            ) : singleTrackLaps.length === 0 ? (
              <div className="text-techie-dim py-8 animate-fade-in">NO LAP DATA</div>
            ) : (
              <>
                <div className="mb-8">
                  <p className="text-techie-dim text-xs uppercase tracking-widest mb-2">Fastest lap</p>
                  <p className="font-display font-bold text-techie-text text-4xl md:text-5xl lg:text-6xl tracking-tight tabular-nums lap-time-updated w-fit">
                    {singleTrackLaps[0].lap_time}
                  </p>
                  <p className="text-techie-accent text-lg md:text-xl mt-2 uppercase tracking-wide w-fit">
                    {singleTrackLaps[0].driver_name}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-techie-dim text-xs uppercase tracking-widest mb-3">Slower times</p>
                  <div className="grid grid-cols-[1fr_7rem_5rem] gap-4 items-baseline">
                    <span className="text-techie-dim text-xs uppercase tracking-widest py-1 border-b border-white/10">Driver</span>
                    <span className="text-techie-dim text-xs uppercase tracking-widest py-1 border-b border-white/10 text-right">Time</span>
                    <span className="text-techie-dim text-xs uppercase tracking-widest py-1 border-b border-white/10 text-right">Delta</span>
                    {singleTrackLaps.slice(1, 11).map((lap) => {
                      const delta = lapTimeToSeconds(lap.lap_time) - fastestSeconds;
                      return (
                        <div
                          key={`fullscreen-lap-${lap.id}`}
                          className="contents"
                        >
                          <span className="text-techie-text truncate uppercase py-2 border-b border-white/5">
                            {lap.driver_name}
                          </span>
                          <span className="techie-embed font-mono tabular-nums text-techie-accent lap-time-updated py-2 border-b border-white/5 text-right">
                            {lap.lap_time}
                          </span>
                          <span className="font-mono tabular-nums text-techie-dim text-sm py-2 border-b border-white/5 text-right">
                            {formatDelta(delta)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : !showFullscreenStatus ? (
          /* Multi-track grid – centered in viewport */
          <div className="max-w-7xl mx-auto w-full space-y-12">
            <div
              className="grid gap-8 md:gap-10 lg:gap-12"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
              }}
            >
              {selectedTracks.map((track, trackIndex) => {
                const laps = lapsByTrack[track.id] ?? [];
                const hasOutline = trackIdsWithOutline.includes(track.id);
                return (
                  <section
                    key={`slot-${trackIndex}-${track.id}`}
                    className="bg-techie-surface/60 rounded-lg overflow-hidden flex animate-slide-up-fade opacity-0"
                    style={{ animationDelay: `${trackIndex * 80}ms` }}
                  >
                    {hasOutline && (
                      <div className="shrink-0 w-28 sm:w-36 border border-white/20 rounded-l-lg bg-techie-embed/70 flex items-center justify-center p-3 min-h-[140px] sm:min-h-[160px]">
                        <img
                          src={getTrackOutlineImageUrl(track.id)}
                          alt=""
                          className="w-full h-24 sm:h-32 object-contain filter brightness-0 invert opacity-90"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 px-6 py-6 space-y-5">
                    <div className="flex items-center gap-2">
                      <span className="text-techie-dim text-sm uppercase tracking-widest">
                        {track.name}
                      </span>
                      <CountryFlag country={track.country} className="text-lg" />
                    </div>
                    <div className="space-y-2">
                      {loading ? (
                        <div className="text-techie-dim py-6 text-sm animate-fade-in">LOADING...</div>
                      ) : laps.length === 0 ? (
                        <div className="text-techie-dim py-6 text-sm animate-fade-in">NO LAP DATA</div>
                      ) : (
                        <div key={`laps-${trackIndex}-${track.id}`} className="space-y-2">
                          {laps.slice(0, 10).map((lap, index) => (
                            <div
                              key={`slot-${trackIndex}-lap-${lap.id}`}
                              className="flex items-baseline justify-between gap-4 py-2 animate-data-in opacity-0"
                              style={{ animationDelay: `${index * 45}ms` }}
                            >
                              <div className="flex items-baseline gap-3 min-w-0">
                                <span className="text-techie-dim tabular-nums w-6 text-sm">
                                  {index + 1}
                                </span>
                                <span className="text-techie-text truncate uppercase text-sm">
                                  {lap.driver_name}
                                </span>
                              </div>
                              <span className="techie-embed font-mono tabular-nums text-techie-accent shrink-0 text-sm lap-time-updated">
                                {lap.lap_time}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>
                  </section>
                );
              })}
            </div>

            {dashboardTrackIds.length === 0 && !loading && (
              <div className="text-techie-dim py-8 text-center text-xs animate-fade-in">
                Configure dashboard tracks in Admin → Dashboard track selection
              </div>
            )}
          </div>
        ) : null}
        </div>
      )}

      {/* Small system overview – bottom corner, hidden when fullscreen error or when live lap is showing */}
      {!showFullscreenStatus && !showLiveLapView && (
        <div className="fixed bottom-4 right-4 bg-techie-surface/90 rounded-sm px-3 py-2 space-y-1 z-10">
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-techie-dim">TIME</span>
            <span className="techie-embed font-mono tabular-nums">{timeStr}</span>
          </div>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-techie-dim">DATE</span>
            <span className="techie-embed font-mono tabular-nums">{dateStr}</span>
          </div>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-techie-dim">STATUS</span>
            <span
              className={`techie-embed ${
                loading ? 'text-techie-dim' : error ? 'text-red-400' : 'text-green-500'
              }`}
            >
              {loading ? 'LOADING' : error ? 'ERROR' : 'LIVE'}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
