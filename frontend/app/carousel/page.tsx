'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  fetchTracks,
  fetchFastestLaps,
  fetchDashboardTracks,
  fetchDashboardTitle,
  fetchCarouselInterval,
  getTrackOutlineImageUrl,
  getTrackOutlineTrackIds,
  hasTrackOutline,
  type Track,
  type Lap,
} from '@/lib/api';
import CountryFlag from '@/components/CountryFlag';

const DEFAULT_SLIDE_INTERVAL_MS = 10000;

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
  const hasSetCarouselRef = useRef(false);
  const now = useClock();

  useEffect(() => {
    setMounted(true);
  }, []);

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

      {error && (
        <div className="relative z-10 px-6 md:px-10">
          <div className="bg-red-950/30 px-5 py-3 rounded-sm text-red-400 text-xs max-w-6xl mx-auto">
            {error}
          </div>
        </div>
      )}

      {carouselTracks.length === 0 && !loading && (
        <div className="fixed inset-0 flex items-center justify-center z-10">
          <p className="text-techie-dim text-sm">No tracks. Add tracks in Admin and select them on the dashboard.</p>
        </div>
      )}

      {currentSlideType === 'fullscreen' && currentTrack && (
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

      {currentSlideType === 'cards' && (
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

      {currentSlideType === 'driver' && currentDriverName && (
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

      {/* Status corner – time, date, live (same as dashboard) */}
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

      {totalSlides > 0 && (
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
