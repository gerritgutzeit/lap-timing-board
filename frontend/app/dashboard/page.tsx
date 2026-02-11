'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { fetchTracks, fetchFastestLaps, fetchDashboardTracks, fetchDashboardTitle, fetchDashboardUp, type Track, type Lap } from '@/lib/api';
import { getTrackOutlineImageUrl, getTrackOutlineTrackIds, hasTrackOutline } from '@/lib/api';
import CountryFlag from '@/components/CountryFlag';
import { useTelemetryLive, TelemetryLiveViewUI } from '@/components/TelemetryLiveView';

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
  const telemetryLiveState = useTelemetryLive();
  const { showLiveLapView } = telemetryLiveState;

  useEffect(() => {
    lapsByTrackRef.current = lapsByTrack;
  }, [lapsByTrack]);

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
      </header>

      <TelemetryLiveViewUI {...telemetryLiveState} />

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
