export type AdminTab = 'dashboard' | 'telemetry' | 'updates' | 'tracks' | 'laps' | 'backup';

export const TABS: { id: AdminTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'updates', label: 'Updates' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'laps', label: 'Laps' },
  { id: 'backup', label: 'Backup' },
];

export const MAX_DASHBOARD_TRACKS = 20;

export const LAP_TIME_REGEX = /^\d{1,2}:\d{2}\.\d{3}$/;
