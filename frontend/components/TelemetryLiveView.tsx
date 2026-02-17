'use client';

import { useEffect, useState, useRef } from 'react';
import {
  fetchTelemetryLive,
  fetchFastestLapByTrackName,
  fetchFastestLapByTrackNameAndDriver,
  addPendingLap,
  type TelemetryLiveState,
  type FastestLapByTrackName,
} from '@/lib/api';

/** Format lap time from milliseconds to fixed-width MM:SS.hh (e.g. 01:32.84). */
export function formatLapTimeFromMs(ms: number): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '——:——.—';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((seconds % 1) * 100);
  const secs = Math.floor(seconds);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

/** Parse "m:ss.xxx" to seconds. */
function lapTimeToSeconds(lapTime: string): number {
  const match = lapTime.trim().match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, m, s, ms] = match;
  return (parseInt(m!, 10) * 60) + parseInt(s!, 10) + parseInt(ms!, 10) / 1000;
}

/** Delta of last lap vs record: negative = faster (green), positive = slower (red). */
export function lastLapDeltaVsRecord(
  lastLapMs: number | null | undefined,
  recordLapTime: string | undefined
): number | null {
  if (lastLapMs == null || lastLapMs <= 0 || !recordLapTime?.trim()) return null;
  const recordSeconds = lapTimeToSeconds(recordLapTime);
  if (recordSeconds <= 0) return null;
  return lastLapMs / 1000 - recordSeconds;
}

export function formatDeltaSigned(seconds: number): string {
  if (seconds === 0) return '0.000s';
  if (seconds < 0) return `${seconds.toFixed(3)}s`;
  return `+${seconds.toFixed(3)}s`;
}

export type TelemetryLiveViewState = {
  telemetry: TelemetryLiveState | null;
  showLiveLapView: boolean;
  lastLapFullscreen: { lastLapTimeMs: number } | null;
  newRecordFullscreen: { lastLapTimeMs: number } | null;
  fastestDbLap: FastestLapByTrackName | null;
  /** Current driver's best lap time on this track (m:ss.xxx), or null if none in DB. */
  driverFastestLapTime: string | null;
};

/** Hook: poll telemetry, fetch fastest lap by track, manage fullscreen overlays. */
export function useTelemetryLive(): TelemetryLiveViewState {
  const [telemetry, setTelemetry] = useState<TelemetryLiveState | null>(null);
  const [fastestDbLap, setFastestDbLap] = useState<FastestLapByTrackName | null>(null);
  const [driverFastestLapTime, setDriverFastestLapTime] = useState<string | null>(null);
  const [lastLapFullscreen, setLastLapFullscreen] = useState<{ lastLapTimeMs: number } | null>(null);
  const [newRecordFullscreen, setNewRecordFullscreen] = useState<{ lastLapTimeMs: number } | null>(null);
  const prevLastLapTimeMsRef = useRef<number | null>(null);

  const showLiveLapView =
    !!telemetry?.isHot &&
    (telemetry?.currentLapTimeMs != null && telemetry.currentLapTimeMs > 0);

  useEffect(() => {
    const trackName = telemetry?.trackName?.trim();
    if (!trackName) {
      setFastestDbLap(null);
      return;
    }
    let cancelled = false;
    const fetchRecord = () => {
      fetchFastestLapByTrackName(trackName)
        .then((data) => {
          if (!cancelled) setFastestDbLap(data ?? null);
        })
        .catch(() => {
          if (!cancelled) setFastestDbLap(null);
        });
    };
    fetchRecord();
    const interval = setInterval(fetchRecord, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [telemetry?.trackName]);

  useEffect(() => {
    const trackName = telemetry?.trackName?.trim();
    const driverName = (telemetry?.driverName || 'Driver').trim();
    if (!trackName || !driverName) {
      setDriverFastestLapTime(null);
      return;
    }
    let cancelled = false;
    const fetchDriverRecord = () => {
      fetchFastestLapByTrackNameAndDriver(trackName, driverName)
        .then((data) => {
          if (!cancelled) setDriverFastestLapTime(data?.fastest?.lapTime ?? null);
        })
        .catch(() => {
          if (!cancelled) setDriverFastestLapTime(null);
        });
    };
    fetchDriverRecord();
    const interval = setInterval(fetchDriverRecord, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [telemetry?.trackName, telemetry?.driverName]);

  useEffect(() => {
    const ms = telemetry?.lastLapTimeMs;
    if (ms == null || ms <= 0) return;
    if (prevLastLapTimeMsRef.current === ms) return;
    prevLastLapTimeMsRef.current = ms;
    const deltaOverall = lastLapDeltaVsRecord(ms, fastestDbLap?.fastest?.lapTime);
    const deltaDriver = lastLapDeltaVsRecord(ms, driverFastestLapTime ?? undefined);
    const isStrictlyFasterThanDriverBest =
      driverFastestLapTime == null || (deltaDriver != null && deltaDriver < -0.001);
    if (telemetry?.trackName?.trim() && isStrictlyFasterThanDriverBest) {
      addPendingLap({
        trackName: telemetry.trackName.trim(),
        lapTimeMs: ms,
        driverName: (telemetry.driverName || 'Driver').trim(),
      }).catch(() => {});
    }
    if (deltaOverall != null && deltaOverall < 0) {
      setNewRecordFullscreen({ lastLapTimeMs: ms });
      setLastLapFullscreen(null);
      const t = setTimeout(() => setNewRecordFullscreen(null), 10000);
      return () => clearTimeout(t);
    }
    setLastLapFullscreen({ lastLapTimeMs: ms });
    setNewRecordFullscreen(null);
    const t = setTimeout(() => setLastLapFullscreen(null), 4000);
    return () => clearTimeout(t);
  }, [telemetry?.lastLapTimeMs, telemetry?.trackName, telemetry?.driverName, fastestDbLap?.fastest?.lapTime, driverFastestLapTime]);

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

  return {
    telemetry,
    showLiveLapView,
    lastLapFullscreen,
    newRecordFullscreen,
    fastestDbLap,
    driverFastestLapTime,
  };
}

type TelemetryLiveViewUIProps = TelemetryLiveViewState & {
  className?: string;
};

/** Renders the RDP/UDP live view: fullscreen overlays + main live lap block. */
export function TelemetryLiveViewUI({
  telemetry,
  showLiveLapView,
  lastLapFullscreen,
  newRecordFullscreen,
  fastestDbLap,
  driverFastestLapTime,
  className = '',
}: TelemetryLiveViewUIProps) {
  if (!showLiveLapView) return null;

  return (
    <>
      {/* Fullscreen: new record – time only, 10s */}
      {newRecordFullscreen && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-techie-bg px-6 animate-last-lap-fullscreen-in"
          aria-live="polite"
          role="status"
        >
          <p className="font-display font-black text-2xl sm:text-3xl uppercase tracking-[0.2em] text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)] mb-6">
            New record
          </p>
          <p className="font-mono font-bold text-techie-text text-7xl sm:text-8xl md:text-9xl tracking-tight tabular-nums text-center">
            {formatLapTimeFromMs(newRecordFullscreen.lastLapTimeMs)}
          </p>
        </div>
      )}

      {/* Fullscreen: last lap time + delta (if slower), 4s */}
      {lastLapFullscreen && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-techie-bg px-6 animate-last-lap-fullscreen-in"
          aria-live="polite"
          role="status"
        >
          <p className="font-mono font-bold text-techie-text text-7xl sm:text-8xl md:text-9xl tracking-tight tabular-nums text-center">
            {formatLapTimeFromMs(lastLapFullscreen.lastLapTimeMs)}
          </p>
          <div className="mt-6 min-h-[3.5rem] flex flex-col items-center justify-center gap-1">
            {(() => {
              const deltaRecord = lastLapDeltaVsRecord(
                lastLapFullscreen.lastLapTimeMs,
                fastestDbLap?.fastest?.lapTime
              );
              const deltaDriver = lastLapDeltaVsRecord(
                lastLapFullscreen.lastLapTimeMs,
                driverFastestLapTime ?? undefined
              );
              const showRecord = deltaRecord != null && deltaRecord > 0;
              const showDriver = deltaDriver != null && deltaDriver !== 0;
              if (!showRecord && !showDriver) return null;
              return (
                <>
                  {showRecord && (
                    <p className="text-red-400 font-mono text-xl sm:text-2xl tabular-nums">
                      vs record {formatDeltaSigned(deltaRecord!)}
                    </p>
                  )}
                  {showDriver && (
                    <p className="text-techie-dim font-mono text-lg sm:text-xl tabular-nums">
                      vs your best {formatDeltaSigned(deltaDriver!)}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Main live lap view – hidden while fullscreen overlays are showing */}
      {!lastLapFullscreen && !newRecordFullscreen && telemetry && (
        <div className={`telemetry-view px-6 bg-techie-bg ${className}`.trim()}>
          <div className="relative z-10 w-full max-w-xl flex flex-col items-center justify-center opacity-0 animate-telemetry-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-f1-red/40 bg-f1-red/10 mb-4 animate-telemetry-live-pulse">
              <span className="w-2 h-2 rounded-full bg-f1-red animate-pulse shadow-[0_0_8px_rgba(225,6,0,0.8)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-f1-red">
                Live
              </span>
            </div>
            {telemetry.trackName && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4 text-techie-dim">
                <span className="text-xl sm:text-2xl font-semibold uppercase tracking-wider text-techie-text">
                  {telemetry.trackName}
                </span>
              </div>
            )}
            <div className="telemetry-card w-full">
              <p className="text-techie-dim text-xs uppercase tracking-[0.25em] mb-5">
                Current lap
              </p>
              <div className="w-full flex justify-center">
                <p
                  className="telemetry-time-block font-mono font-bold text-techie-text text-6xl sm:text-7xl md:text-8xl tracking-tight animate-telemetry-time-in animate-telemetry-glow"
                  aria-live="polite"
                >
                  {formatLapTimeFromMs(telemetry.currentLapTimeMs ?? 0)}
                </p>
              </div>
            </div>
            <p
              className="text-techie-dim text-sm mt-5 font-mono tabular-nums opacity-0 animate-telemetry-time-in"
              style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
            >
              Last lap{' '}
              <span className="inline-block w-[8ch] text-center">
                {telemetry.lastLapTimeMs != null && telemetry.lastLapTimeMs > 0
                  ? formatLapTimeFromMs(telemetry.lastLapTimeMs)
                  : '—:—.—'}
              </span>
              {(() => {
                const lastLapDelta = lastLapDeltaVsRecord(
                  telemetry.lastLapTimeMs,
                  fastestDbLap?.fastest?.lapTime
                );
                if (lastLapDelta == null) return null;
                return (
                  <span
                    className={`ml-2 text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                      lastLapDelta < 0
                        ? 'text-green-400 bg-green-500/15'
                        : 'text-red-400 bg-red-500/15'
                    }`}
                    title={
                      lastLapDelta < 0 ? 'Faster than record' : 'Slower than record'
                    }
                  >
                    {formatDeltaSigned(lastLapDelta)}
                  </span>
                );
              })()}
            </p>
            {driverFastestLapTime && (
              <p
                className="text-techie-dim text-sm mt-2 font-mono tabular-nums opacity-0 animate-telemetry-time-in"
                style={{ animationDelay: '0.48s', animationFillMode: 'forwards' }}
              >
                Your best{' '}
                <span className="inline-block w-[8ch] text-center text-techie-accent">
                  {driverFastestLapTime}
                </span>
                {(() => {
                  const deltaDriver = lastLapDeltaVsRecord(
                    telemetry.lastLapTimeMs,
                    driverFastestLapTime
                  );
                  if (deltaDriver == null) return null;
                  return (
                    <span
                      className={`ml-2 text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                        deltaDriver < 0
                          ? 'text-green-400 bg-green-500/15'
                          : 'text-red-400 bg-red-500/15'
                      }`}
                      title={
                        deltaDriver < 0 ? 'Faster than your best' : 'Slower than your best'
                      }
                    >
                      {formatDeltaSigned(deltaDriver)}
                    </span>
                  );
                })()}
              </p>
            )}
            <p
              className="text-techie-dim text-sm mt-2 font-mono tabular-nums opacity-0 animate-telemetry-time-in"
              style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
            >
              Record{' '}
              <span className="inline-block w-[8ch] text-center text-techie-accent">
                {fastestDbLap?.fastest ? fastestDbLap.fastest.lapTime : '—:—.—'}
              </span>
              {fastestDbLap?.fastest?.driverName && (
                <span className="ml-2 text-techie-dim">
                  ({fastestDbLap.fastest.driverName})
                </span>
              )}
            </p>
            {telemetry.driverName && (
              <p
                className="text-techie-dim text-sm mt-auto pt-6 opacity-0 animate-telemetry-time-in"
                style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
              >
                Current Driver:{' '}
                <span className="font-medium text-techie-accent">
                  {telemetry.driverName}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Single component: uses useTelemetryLive and renders the full RDP live view. */
export default function TelemetryLiveView({ className }: { className?: string }) {
  const state = useTelemetryLive();
  return <TelemetryLiveViewUI {...state} className={className} />;
}
