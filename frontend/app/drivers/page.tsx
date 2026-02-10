'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchTracks,
  fetchFastestLaps,
  fetchDashboardTracks,
  fetchDashboardTitle,
  type Track,
  type Lap,
} from '@/lib/api';
import CountryFlag from '@/components/CountryFlag';

function lapTimeToSeconds(lapTime: string): number {
  const match = lapTime.trim().match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, m, s, ms] = match;
  return (parseInt(m!, 10) * 60) + parseInt(s!, 10) + parseInt(ms!, 10) / 1000;
}

type DriverLapEntry = { trackId: number; trackName: string; country: string; lapTime: string; position: number };

function buildDriverLaps(
  driverName: string,
  tracksList: Track[],
  lapsByTrack: Record<number, Lap[]>
): DriverLapEntry[] {
  const entries: DriverLapEntry[] = [];
  for (const track of tracksList) {
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

export default function DriversPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [displayTracks, setDisplayTracks] = useState<Track[]>([]);
  const [lapsByTrack, setLapsByTrack] = useState<Record<number, Lap[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardTitle, setDashboardTitle] = useState<string>('F1 TIMING');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

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
    fetchDashboardTitle().then((t) => setDashboardTitle(t || 'F1 TIMING')).catch(() => {});
  }, []);

  useEffect(() => {
    if (tracks.length === 0) return;
    (async () => {
      const ids = await fetchDashboardTracks().catch(() => []);
      const list = ids.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
      const trackList = list.length > 0 ? list : tracks;
      setDisplayTracks(trackList);
      loadLapsForTracks(trackList.map((t) => t.id));
    })();
  }, [tracks]);

  const driversList = useMemo(() => {
    const set = new Set<string>();
    Object.values(lapsByTrack).forEach((laps) => laps.forEach((l) => set.add(l.driver_name)));
    return Array.from(set).sort();
  }, [lapsByTrack]);

  const selectedDriverLaps = useMemo(
    () =>
      selectedDriver ? buildDriverLaps(selectedDriver, displayTracks, lapsByTrack) : [],
    [selectedDriver, displayTracks, lapsByTrack]
  );

  return (
    <main className="min-h-screen bg-techie-bg text-techie-text font-mono text-sm antialiased">
      <header className="flex items-center justify-between px-6 md:px-10 py-4">
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
          <Link href="/carousel" className="text-sm text-techie-dim hover:text-techie-text transition-colors">
            Carousel
          </Link>
        </div>
      </header>

      {error && (
        <div className="px-6 md:px-10">
          <div className="bg-red-950/30 px-5 py-3 rounded-sm text-red-400 text-xs max-w-6xl mx-auto">
            {error}
          </div>
        </div>
      )}

      <div className="px-6 md:px-10 pb-16 max-w-4xl mx-auto">
        <h1 className="text-techie-dim text-xs uppercase tracking-widest mb-2">Drivers</h1>
        <p className="text-techie-text font-display font-bold text-2xl md:text-3xl uppercase tracking-wide mb-6">
          Choose a driver
        </p>

        {loading && displayTracks.length === 0 ? (
          <div className="text-techie-dim py-8">Loading…</div>
        ) : driversList.length === 0 ? (
          <div className="text-techie-dim py-8">Keine Fahrer. Strecken im Dashboard auswählen und Zeiten anlegen.</div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-10">
            {driversList.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedDriver(name)}
                className={`px-4 py-2 rounded border font-semibold uppercase tracking-wide transition-colors ${
                  selectedDriver === name
                    ? 'bg-techie-accent text-techie-bg border-techie-accent'
                    : 'bg-techie-surface/60 text-techie-text border-white/20 hover:border-techie-accent/50 hover:text-techie-accent'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {selectedDriver && (
          <section className="border border-white/10 rounded-lg bg-techie-surface/30 p-6">
            <p className="text-techie-dim text-xs uppercase tracking-widest mb-2">Driver</p>
            <p className="font-display font-bold text-techie-accent text-3xl md:text-4xl uppercase tracking-wide mb-6">
              {selectedDriver}
            </p>
            {selectedDriverLaps.length === 0 ? (
              <div className="text-techie-dim py-6">Keine Zeiten für diesen Fahrer.</div>
            ) : (
              <div className="grid grid-cols-[auto_1fr_5rem_4rem] gap-3 md:gap-4 items-baseline">
                <span className="text-techie-dim text-xs uppercase tracking-widest">#</span>
                <span className="text-techie-dim text-xs uppercase tracking-widest">Strecke</span>
                <span className="text-techie-dim text-xs uppercase tracking-widest text-right">Zeit</span>
                <span className="text-techie-dim text-xs uppercase tracking-widest text-right">Pos</span>
                {selectedDriverLaps.map((entry, idx) => {
                  const isP1 = entry.position === 1;
                  return (
                    <div
                      key={`${entry.trackId}-${entry.lapTime}`}
                      className={`col-span-4 grid grid-cols-[auto_1fr_5rem_4rem] gap-3 md:gap-4 items-baseline py-1.5 rounded px-2 -mx-2 ${isP1 ? 'border border-green-500/40 bg-green-500/10' : ''}`}
                    >
                      <span className={`tabular-nums text-sm ${isP1 ? 'text-green-400' : 'text-techie-dim'}`}>
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`truncate uppercase ${isP1 ? 'text-green-400 font-semibold' : 'text-techie-text'}`}
                        >
                          {entry.trackName}
                        </span>
                        <CountryFlag country={entry.country} className="shrink-0" />
                      </div>
                      <span
                        className={`font-mono tabular-nums text-right ${isP1 ? 'text-green-400 techie-embed' : 'techie-embed text-techie-accent'}`}
                      >
                        {entry.lapTime}
                      </span>
                      <span
                        className={`font-mono tabular-nums text-sm text-right ${isP1 ? 'text-green-400 font-semibold' : 'text-techie-dim'}`}
                      >
                        P{entry.position}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
