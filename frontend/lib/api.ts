const DEFAULT_API_PORT = '3001';

/** Resolve API base URL: use build-time override, or in the browser use current host + port so the same build works when opened from another machine on the network. Exported for debugging (e.g. in console: check which URL the app uses). */
export function getApiBase(): string {
  const buildUrl = process.env.NEXT_PUBLIC_API_URL;
  if (buildUrl && buildUrl !== 'undefined') return buildUrl;
  if (typeof window !== 'undefined')
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}/api`;
  return `http://localhost:${DEFAULT_API_PORT}/api`;
}

/** URL for a track's outline image (used as fullscreen background when that track is selected). */
export function getTrackOutlineImageUrl(trackId: number): string {
  return `${getApiBase()}/config/track-outline/${trackId}`;
}

export type Track = {
  id: number;
  name: string;
  country: string;
  created_at: string;
};

export type Lap = {
  id: number;
  driver_name: string;
  lap_time: string;
  track_id: number;
  created_at: string;
  track_name?: string;
  country?: string;
};

export async function fetchTracks(): Promise<Track[]> {
  const res = await fetch(`${getApiBase()}/tracks`);
  if (!res.ok) throw new Error('Failed to fetch tracks');
  return res.json();
}

export async function createTrack(name: string, country: string): Promise<Track> {
  const res = await fetch(`${getApiBase()}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, country }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create track');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({ id: 0, name, country, created_at: new Date().toISOString() } as Track);
}

export async function deleteTrack(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/tracks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete track');
}

export async function fetchLaps(options?: { trackId?: number; driverName?: string }): Promise<Lap[]> {
  const params = new URLSearchParams();
  if (options?.trackId != null) params.set('track_id', String(options.trackId));
  const name = typeof options?.driverName === 'string' ? options.driverName.trim() : '';
  if (name) params.set('driver_name', name);
  const qs = params.toString();
  const url = qs ? `${getApiBase()}/laps?${qs}` : `${getApiBase()}/laps`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch laps');
  return res.json();
}

export async function fetchFastestLaps(trackId: number): Promise<Lap[]> {
  const res = await fetch(`${getApiBase()}/laps/track/${trackId}`);
  if (!res.ok) throw new Error('Failed to fetch fastest laps');
  return res.json();
}

/** Fastest lap in DB for a track matched by name (for telemetry comparison). */
export type FastestLapByTrackName = {
  trackId: number;
  trackName: string;
  fastest: { lapTime: string; driverName: string; lapId: number } | null;
};

export async function fetchFastestLapByTrackName(trackName: string): Promise<FastestLapByTrackName | null> {
  const name = String(trackName).trim();
  if (!name) return null;
  const res = await fetch(`${getApiBase()}/laps/fastest-by-track-name?name=${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch fastest lap by track name');
  return res.json();
}

export async function createLap(driver_name: string, lap_time: string, track_id: number): Promise<Lap> {
  const res = await fetch(`${getApiBase()}/laps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driver_name, lap_time, track_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add lap');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as Lap);
}

export async function updateLap(
  id: number,
  data: { driver_name?: string; lap_time?: string }
): Promise<Lap> {
  const res = await fetch(`${getApiBase()}/laps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update lap');
  }
  return res.json();
}

export async function deleteLap(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/laps/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete lap');
}

export async function fetchDashboardTracks(): Promise<number[]> {
  const res = await fetch(`${getApiBase()}/config/dashboard-tracks`);
  if (res.status === 404) return []; // config endpoint not available (e.g. backend not restarted)
  if (!res.ok) throw new Error('Failed to fetch dashboard tracks');
  const data = await res.json();
  return Array.isArray(data.trackIds) ? data.trackIds : [];
}

export async function setDashboardTracks(trackIds: number[]): Promise<number[]> {
  const res = await fetch(`${getApiBase()}/config/dashboard-tracks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackIds }),
  });
  if (!res.ok) throw new Error('Failed to save dashboard tracks');
  const data = await res.json();
  return Array.isArray(data.trackIds) ? data.trackIds : [];
}

export async function fetchDashboardTitle(): Promise<string> {
  const res = await fetch(`${getApiBase()}/config/dashboard-title`);
  if (res.status === 404) return 'F1 TIMING';
  if (!res.ok) throw new Error('Failed to fetch dashboard title');
  const data = await res.json();
  return typeof data.title === 'string' ? data.title : 'F1 TIMING';
}

export async function setDashboardTitle(title: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/config/dashboard-title`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title.trim() }),
  });
  if (!res.ok) throw new Error('Failed to save dashboard title');
  const data = await res.json();
  return typeof data.title === 'string' ? data.title : title;
}

export async function fetchDashboardUp(): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/config/dashboard-up`);
  if (res.status === 404 || !res.ok) return true;
  const data = await res.json();
  return data.up === true;
}

export async function setDashboardUp(up: boolean): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/config/dashboard-up`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ up }),
  });
  if (!res.ok) throw new Error('Failed to set dashboard status');
  const data = await res.json();
  return data.up === true;
}

export async function fetchCarouselInterval(): Promise<number> {
  const res = await fetch(`${getApiBase()}/config/carousel-interval`);
  if (res.status === 404 || !res.ok) return 10000;
  const data = await res.json();
  const ms = typeof data.intervalMs === 'number' ? data.intervalMs : 10000;
  return Math.max(3000, Math.min(120000, ms));
}

export async function setCarouselInterval(intervalMs: number): Promise<number> {
  const res = await fetch(`${getApiBase()}/config/carousel-interval`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervalMs }),
  });
  if (!res.ok) throw new Error('Failed to save carousel interval');
  const data = await res.json();
  return typeof data.intervalMs === 'number' ? data.intervalMs : intervalMs;
}

export async function fetchDisabledDrivers(): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/config/disabled-drivers`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('Failed to fetch disabled drivers');
  const data = await res.json();
  return Array.isArray(data.driverNames) ? data.driverNames : [];
}

export async function setDisabledDrivers(driverNames: string[]): Promise<string[]> {
  const res = await fetch(`${getApiBase()}/config/disabled-drivers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverNames }),
  });
  if (!res.ok) throw new Error('Failed to save disabled drivers');
  const data = await res.json();
  return Array.isArray(data.driverNames) ? data.driverNames : [];
}

export async function deleteDriverLaps(driverName: string): Promise<{ deleted: number }> {
  const res = await fetch(
    `${getApiBase()}/laps/by-driver?driver_name=${encodeURIComponent(driverName)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete driver laps');
  return res.json();
}

export async function hasTrackOutline(trackId: number): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/config/track-outline/${trackId}/exists`);
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.hasImage;
}

/** Returns track IDs that have an outline image uploaded. */
export async function getTrackOutlineTrackIds(): Promise<number[]> {
  const res = await fetch(`${getApiBase()}/config/track-outline/track-ids`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.trackIds) ? data.trackIds : [];
}

export async function uploadTrackOutline(trackId: number, base64Image: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/config/track-outline/${trackId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to upload image');
  }
}

export type DatabaseBackup = {
  version: number;
  exportedAt: string;
  tracks: Track[];
  laps: { id?: number; driver_name: string; lap_time: string; track_id: number; created_at?: string }[];
  dashboardTrackIds: number[];
};

export async function exportDatabase(): Promise<DatabaseBackup> {
  const res = await fetch(`${getApiBase()}/database/export`);
  if (!res.ok) throw new Error('Failed to export database');
  return res.json();
}

export async function importDatabase(backup: DatabaseBackup): Promise<{ success: boolean; tracksCreated: number; lapsCreated: number }> {
  const res = await fetch(`${getApiBase()}/database/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to import database');
  }
  return res.json();
}

/** F1 25 UDP telemetry: live lap state from Lap Data packets. */
export type TelemetryLiveState = {
  currentLapTimeMs: number | null;
  lastLapTimeMs: number | null;
  receivedAt: number | null;
  error: string | null;
  isHot: boolean;
  trackName: string | null;
  driverName: string | null;
};

export async function fetchTelemetryLive(): Promise<TelemetryLiveState> {
  const res = await fetch(`${getApiBase()}/telemetry/live`);
  if (!res.ok) throw new Error('Failed to fetch telemetry');
  return res.json();
}

export type UdpTelemetryConfig = { bindAddress: string; port: number };

export async function fetchUdpTelemetryConfig(): Promise<UdpTelemetryConfig> {
  const res = await fetch(`${getApiBase()}/config/udp-telemetry`);
  if (!res.ok) throw new Error('Failed to fetch UDP telemetry config');
  return res.json();
}

export async function setUdpTelemetryConfig(config: UdpTelemetryConfig): Promise<UdpTelemetryConfig> {
  const res = await fetch(`${getApiBase()}/config/udp-telemetry`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save UDP telemetry config');
  return res.json();
}

export async function fetchUdpTelemetryDriverAlias(): Promise<string> {
  const res = await fetch(`${getApiBase()}/config/udp-telemetry-driver-alias`);
  if (!res.ok) throw new Error('Failed to fetch driver alias');
  const data = await res.json();
  return typeof data.driverAlias === 'string' ? data.driverAlias : '';
}

export async function setUdpTelemetryDriverAlias(driverAlias: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/config/udp-telemetry-driver-alias`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverAlias: String(driverAlias).trim() }),
  });
  if (!res.ok) throw new Error('Failed to save driver alias');
  const data = await res.json();
  return typeof data.driverAlias === 'string' ? data.driverAlias : '';
}
