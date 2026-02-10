'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  fetchTracks,
  fetchFastestLaps,
  fetchDashboardTracks,
  fetchDashboardTitle,
  fetchCarouselInterval,
  fetchTelemetryLive,
  fetchFastestLapByTrackName,
  getTrackOutlineImageUrl,
  getTrackOutlineTrackIds,
  hasTrackOutline,
  type Track,
  type Lap,
  type TelemetryLiveState,
  type FastestLapByTrackName,
} from '@/lib/api';
import CountryFlag from '@/components/CountryFlag';

const DEFAULT_SLIDE_INTERVAL_MS = 10000;

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

function lapTimeToSeconds(lapTime: string): number {
  const match = lapTime.trim().match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, m, s, ms] = match;
  return (parseInt(m!, 10) * 60) + parseInt(s!, 10) + parseInt(ms!, 10) / 1000;
}

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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

type DriverLapEntry = { trackId: number; trackName: string; country: string; lapTime: string; position: number };

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function buildDriverLaps(
  driverName: string,
  carouselTracks: Track[],
  lapsByTrack: Record<number, Lap[]>
): DriverLapEntry[] {
  const entries: DriverLapEntry[] = [];
  for (const track of carouselTracks) {
    const laps = lapsByTrack[track.id] ?? [];
    const driverLaps = laps.filter((l) => l.driver_name === driverName);
    if (driverLaps.length === 0) continue;
    const best = driverLaps.reduce((a, b) => (lapTimeToSeconds(a.lap_time) <= lapTimeToSeconds(b.lap_time) ? a : b));
    const position = laps.filter((l) => lapTimeToSeconds(l.lap_time) < lapTimeToSeconds(best.lap_time)).length + 1;
    entries.push({
      trackId: track.id,
      trackName: track.name,
      country: track.country,
      lapTime: best.lap_time,
      position,
    });
  }
  return entries.sort((a, b) => lapTimeToSeconds(a.lapTime) - lapTimeToSeconds(b.lapTime));
}

export default function CarouselPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [carouselTracks, setCarouselTracks] = useState<Track[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [lapsByTrack, setLapsByTrack] = useState<Record<number, Lap[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackIdsWithOutline, setTrackIdsWithOutline] = useState<number[]>([]);
  const [dashboardTitle, setDashboardTitle] = useState<string>('F1 TIMING');
  const [slideIntervalMs, setSlideIntervalMs] = useState<number>(DEFAULT_SLIDE_INTERVAL_MS);
  const [mounted, setMounted] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryLiveState | null>(null);
  const [fastestDbLap, setFastestDbLap] = useState<FastestLapByTrackName | null>(null);
  const prevLastLapTimeMsRef = useRef<number | null>(null);
  const [lastLapFullscreen, setLastLapFullscreen] = useState<{ lastLapTimeMs: number } | null>(null);
  const [newRecordFullscreen, setNewRecordFullscreen] = useState<{ lastLapTimeMs: number } | null>(null);
  const hasSetCarouselRef = useRef(false);
  const now = useClock();

  useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [telemetry?.lastLapTimeMs, fastestDbLap?.fastest?.lapTime]);

  // Poll F1 25 UDP telemetry; when hot, show live lap overlay on carousel
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

  const showLiveLapView = !!telemetry?.isHot && telemetry?.currentLapTimeMs != null;

  const timeStr = mounted ? now.toTimeString().slice(0, 8).replace(/:/g, ' ') : '— — —';
  const dateStr = mounted ? now.toISOString().slice(0, 10).replace(/-/g, ' ') : '— — — — —';

  const loadTracks = async () => {
    try {
      const data = await fetchTracks();
      setTracks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch tracks');
    }
  };

  const loadLapsForTracks = async (trackIds: number[]) => {
    if (trackIds.length === 0) {
      setLapsByTrack({});
      setLoading(false);
      return;
    }
    setLoading(true);
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
    getTrackOutlineTrackIds().then(setTrackIdsWithOutline).catch(() => setTrackIdsWithOutline([]));
    fetchDashboardTitle().then((t) => setDashboardTitle(t || 'F1 TIMING')).catch(() => {});
    fetchCarouselInterval().then(setSlideIntervalMs).catch(() => {});
    const refetchInterval = setInterval(() => {
      fetchCarouselInterval().then(setSlideIntervalMs).catch(() => {});
    }, 60000);
    return () => clearInterval(refetchInterval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tracks.length === 0) return;
      const ids = await fetchDashboardTracks().catch(() => []);
      if (cancelled) return;
      const list = ids.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
      const trackList = list.length > 0 ? list : tracks;
      loadLapsForTracks(trackList.map((t) => t.id));
      if (trackList.length > 0 && !hasSetCarouselRef.current) {
        setCarouselTracks(shuffle(trackList));
        hasSetCarouselRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  const driversList = useMemo(() => {
    const set = new Set<string>();
    Object.values(lapsByTrack).forEach((laps) => laps.forEach((l) => set.add(l.driver_name)));
    return Array.from(set).sort();
  }, [lapsByTrack]);

  const totalSlides = useMemo(() => {
    const n = carouselTracks.length;
    if (n === 0) return 0;
    return n * 3;
  }, [carouselTracks.length]);

  const currentSlideType = useMemo(() => {
    if (totalSlides === 0) return null;
    const i = slideIndex % totalSlides;
    const type = i % 3;
    if (type === 0) return 'fullscreen' as const;
    if (type === 1) return 'cards' as const;
    return 'driver' as const;
  }, [slideIndex, totalSlides]);

  const currentTrackIndex = useMemo(() => {
    if (currentSlideType !== 'fullscreen') return 0;
    return Math.floor((slideIndex % totalSlides) / 3);
  }, [slideIndex, totalSlides, currentSlideType]);

  const currentDriverIndex = useMemo(() => {
    if (currentSlideType !== 'driver') return 0;
    return Math.floor((slideIndex % totalSlides) / 3) % Math.max(1, driversList.length);
  }, [slideIndex, totalSlides, currentSlideType, driversList.length]);

  const currentTrack = carouselTracks[currentTrackIndex] ?? null;
  const currentLaps = currentTrack ? (lapsByTrack[currentTrack.id] ?? []) : [];
  const fastestSeconds = currentLaps.length > 0 ? lapTimeToSeconds(currentLaps[0].lap_time) : 0;
  const trackOutlineUrl = currentTrack ? getTrackOutlineImageUrl(currentTrack.id) : '';
  const [hasTrackOutlineImage, setHasTrackOutlineImage] = useState(false);
  const currentDriverName = driversList[currentDriverIndex] ?? '';
  const currentDriverLaps = useMemo(
    () => (currentDriverName ? buildDriverLaps(currentDriverName, carouselTracks, lapsByTrack) : []),
    [currentDriverName, carouselTracks, lapsByTrack]
  );

  useEffect(() => {
    if (!currentTrack) {
      setHasTrackOutlineImage(false);
      return;
    }
    hasTrackOutline(currentTrack.id).then(setHasTrackOutlineImage).catch(() => setHasTrackOutlineImage(false));
  }, [currentTrack?.id]);

  useEffect(() => {
    if (totalSlides <= 0) return;
    const interval = Math.max(3000, Math.min(120000, slideIntervalMs));
    const t = setInterval(() => {
      setSlideIndex((i) => i + 1);
    }, interval);
    return () => clearInterval(t);
  }, [totalSlides, slideIntervalMs]);

  const cardsToShow = useMemo(() => carouselTracks.slice(0, 4), [carouselTracks]);

  return (
    <main className="min-h-screen bg-techie-bg text-techie-text font-mono text-sm antialiased">
      <header className="flex items-center justify-between px-6 md:px-10 py-4 relative z-20">
        <Link
          href="/"
          className="font-display font-semibold text-techie-text hover:text-techie-accent transition-colors tracking-[0.2em] text-xl uppercase"
        >
          {dashboardTitle}
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-techie-dim hover:text-techie-text transition-colors">
            ← Dashboard
          </Link>
          <Link href="/drivers" className="text-sm text-techie-dim hover:text-techie-text transition-colors">
            Drivers
          </Link>
        </div>
      </header>

      {error && !showLiveLapView && (
        <div className="relative z-10 px-6 md:px-10">
          <div className="bg-red-950/30 px-5 py-3 rounded-sm text-red-400 text-xs max-w-6xl mx-auto">
            {error}
          </div>
        </div>
      )}

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
        <div className="telemetry-view px-6 bg-techie-bg z-20">
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

      {carouselTracks.length === 0 && !loading && !showLiveLapView && (
        <div className="fixed inset-0 flex items-center justify-center z-10">
          <p className="text-techie-dim text-sm">No tracks. Add tracks in Admin and select them on the dashboard.</p>
        </div>
      )}

      {!showLiveLapView && currentSlideType === 'fullscreen' && currentTrack && (
        <>
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden>
            <div className="absolute inset-0 bg-techie-bg" />
            {hasTrackOutlineImage && (
              <div
                className="absolute top-0 right-0 w-[40%] max-w-[400px] h-[40%] max-h-[400px] mt-6 mr-6 opacity-0 animate-carousel-outline"
                style={{
                  backgroundImage: `url(${trackOutlineUrl})`,
                  backgroundSize: 'contain',
                  backgroundPosition: '100% 0%',
                  backgroundRepeat: 'no-repeat',
                  filter: 'brightness(0) invert(1)',
                }}
              />
            )}
          </div>
          <div className="relative z-10 px-6 md:px-10 pb-24 min-h-[70vh] flex flex-col justify-center">
            <div
              key={`fullscreen-${currentTrack.id}`}
              className="flex flex-col justify-center max-w-4xl mx-auto w-full opacity-0 animate-carousel-in"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="font-display font-semibold text-techie-text text-2xl md:text-4xl lg:text-5xl uppercase tracking-[0.2em]">{currentTrack.name}</span>
                <CountryFlag country={currentTrack.country} className="scale-125" />
              </div>
              {loading ? (
                <div className="text-techie-dim py-8">LOADING...</div>
              ) : currentLaps.length === 0 ? (
                <div className="text-techie-dim py-8">NO LAP DATA</div>
              ) : (
                <>
                  <div className="mb-8">
                    <p className="text-techie-dim text-xs uppercase tracking-widest mb-2">Fastest lap</p>
                    <p className="font-display font-bold text-techie-text text-4xl md:text-5xl lg:text-6xl tracking-tight tabular-nums">
                      {currentLaps[0].lap_time}
                    </p>
                    <p className="text-techie-accent text-lg md:text-xl mt-2 uppercase tracking-wide">
                      {currentLaps[0].driver_name}
                    </p>
                  </div>
                  <div className="grid grid-cols-[1fr_7rem_5rem] gap-4 items-baseline">
                    <span className="text-techie-dim text-xs uppercase tracking-widest py-1 border-b border-white/10">Driver</span>
                    <span className="text-techie-dim text-xs uppercase tracking-widest py-1 border-b border-white/10 text-right">Time</span>
                    <span className="text-techie-dim text-xs uppercase tracking-widest py-1 border-b border-white/10 text-right">Delta</span>
                    {currentLaps.slice(0, 10).map((lap, idx) => {
                      const delta = lapTimeToSeconds(lap.lap_time) - fastestSeconds;
                      return (
                        <div key={lap.id} className="col-span-3 grid grid-cols-[1fr_7rem_5rem] gap-4 items-baseline opacity-0 animate-carousel-row" style={{ animationDelay: `${280 + idx * 45}ms` }}>
                          <span className="text-techie-text truncate uppercase py-2 border-b border-white/5">{lap.driver_name}</span>
                          <span className="techie-embed font-mono tabular-nums text-techie-accent py-2 border-b border-white/5 text-right">{lap.lap_time}</span>
                          <span className="font-mono tabular-nums text-techie-dim text-sm py-2 border-b border-white/5 text-right">{formatDelta(delta)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {!showLiveLapView && currentSlideType === 'cards' && (
        <div className="relative z-10 px-6 md:px-12 lg:px-16 pb-24 flex flex-col min-h-[calc(100vh-6rem)] justify-center">
          <div className="max-w-7xl mx-auto w-full">
            <p className="text-techie-dim text-xs uppercase tracking-widest mb-6 text-center opacity-0 animate-carousel-in-fast" style={{ animationDelay: '0ms' }}>Tracks</p>
            <div
              className="grid gap-6 md:gap-8"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}
            >
              {cardsToShow.map((track, idx) => {
                const laps = lapsByTrack[track.id] ?? [];
                const hasOutline = trackIdsWithOutline.includes(track.id);
                return (
                  <section
                    key={track.id}
                    className="bg-techie-surface/70 rounded-xl overflow-hidden flex opacity-0 animate-carousel-card border border-white/10 shadow-lg"
                    style={{ animationDelay: `${120 + idx * 100}ms` }}
                  >
                    {hasOutline && (
                      <div className="shrink-0 w-24 sm:w-28 border-r border-white/20 bg-techie-embed/70 flex items-center justify-center p-2 min-h-[120px]">
                        <img
                          src={getTrackOutlineImageUrl(track.id)}
                          alt=""
                          className="w-full h-20 object-contain filter brightness-0 invert opacity-90"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 px-4 py-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-techie-dim text-xs uppercase tracking-widest">{track.name}</span>
                        <CountryFlag country={track.country} className="text-base" />
                      </div>
                      {loading ? (
                        <div className="text-techie-dim py-4 text-xs">LOADING...</div>
                      ) : laps.length === 0 ? (
                        <div className="text-techie-dim py-4 text-xs">NO LAP DATA</div>
                      ) : (
                        <div className="space-y-1">
                          {laps.slice(0, 6).map((lap, i) => (
                            <div key={lap.id} className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="text-techie-dim tabular-nums w-5">{i + 1}</span>
                              <span className="text-techie-text truncate uppercase flex-1">{lap.driver_name}</span>
                              <span className="techie-embed font-mono tabular-nums text-techie-accent shrink-0">{lap.lap_time}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!showLiveLapView && currentSlideType === 'driver' && currentDriverName && (
        <div className="relative z-10 px-6 md:px-10 pb-24 min-h-[70vh] flex flex-col justify-center">
          <div
            key={`driver-${currentDriverName}`}
            className="flex flex-col justify-center max-w-2xl mx-auto w-full opacity-0 animate-carousel-driver"
          >
            <p className="text-techie-dim text-xs uppercase tracking-widest mb-2">Driver</p>
            <p className="font-display font-bold text-techie-accent text-3xl md:text-4xl uppercase tracking-wide mb-6">
              {currentDriverName}
            </p>
            {currentDriverLaps.length === 0 ? (
              <div className="text-techie-dim py-6">Keine Zeiten für diesen Fahrer.</div>
            ) : (
              <div className="grid grid-cols-[auto_1fr_5rem_4rem] gap-3 md:gap-4 items-baseline">
                <span className="text-techie-dim text-xs uppercase tracking-widest">#</span>
                <span className="text-techie-dim text-xs uppercase tracking-widest">Strecke</span>
                <span className="text-techie-dim text-xs uppercase tracking-widest text-right">Zeit</span>
                <span className="text-techie-dim text-xs uppercase tracking-widest text-right">Pos</span>
                {currentDriverLaps.map((entry, idx) => {
                  const isP1 = entry.position === 1;
                  return (
                    <div
                      key={`${entry.trackId}-${entry.lapTime}`}
                      className={`col-span-4 grid grid-cols-[auto_1fr_5rem_4rem] gap-3 md:gap-4 items-baseline opacity-0 animate-carousel-row py-1.5 rounded px-2 -mx-2 ${isP1 ? 'border border-green-500/40 bg-green-500/10' : ''}`}
                      style={{ animationDelay: `${180 + idx * 50}ms` }}
                    >
                      <span className={`tabular-nums text-sm ${isP1 ? 'text-green-400' : 'text-techie-dim'}`}>{idx + 1}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`truncate uppercase ${isP1 ? 'text-green-400 font-semibold' : 'text-techie-text'}`}>{entry.trackName}</span>
                        <CountryFlag country={entry.country} className="shrink-0" />
                      </div>
                      <span className={`font-mono tabular-nums text-right ${isP1 ? 'text-green-400 techie-embed' : 'techie-embed text-techie-accent'}`}>{entry.lapTime}</span>
                      <span className={`font-mono tabular-nums text-sm text-right ${isP1 ? 'text-green-400 font-semibold' : 'text-techie-dim'}`}>P{entry.position}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status corner – time, date, live (same as dashboard); hide when live lap overlay is on */}
      {!showLiveLapView && (
      <div className="fixed bottom-5 right-4 bg-techie-surface/90 rounded-sm px-3 py-2 space-y-1 z-10">
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

      {totalSlides > 0 && !showLiveLapView && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10 items-center">
          {Array.from({ length: totalSlides }).map((_, i) => {
            const active = (slideIndex % totalSlides) === i;
            return (
              <div
                key={i}
                className={`h-1.5 rounded-full origin-center transition-all duration-500 ease-out ${active ? 'w-7 bg-techie-accent scale-100 opacity-100' : 'w-2 bg-white/25 opacity-70'}`}
                style={active ? { boxShadow: '0 0 12px rgba(192,192,192,0.35)' } : undefined}
                aria-hidden
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
