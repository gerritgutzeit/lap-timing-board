'use client';

import type { Lap } from '@/lib/api';

type Props = {
  tracks: { id: number; name: string }[];
  laps: Lap[];
  loading: boolean;
  newLapDriver: string;
  setNewLapDriver: (v: string) => void;
  newLapTime: string;
  setNewLapTime: (v: string) => void;
  newLapTrackId: string;
  setNewLapTrackId: (v: string) => void;
  lapFilterTrackId: string;
  setLapFilterTrackId: (v: string) => void;
  lapFilterDriver: string;
  setLapFilterDriver: (v: string) => void;
  uniqueDriverNames: string[];
  filteredLaps: Lap[];
  editingLapId: number | null;
  editDriver: string;
  setEditDriver: (v: string) => void;
  editLapTime: string;
  setEditLapTime: (v: string) => void;
  onCreateLap: (e: React.FormEvent) => Promise<void>;
  onStartEditLap: (lap: Lap) => void;
  onCancelEditLap: () => void;
  onSaveLap: (e: React.FormEvent) => Promise<void>;
  onDeleteLap: (id: number) => Promise<void>;
};

const sectionClass = 'bg-f1-panel border border-f1-border rounded-xl p-6';

export function AdminLapsTab({
  tracks,
  laps,
  loading,
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
  onCreateLap,
  onStartEditLap,
  onCancelEditLap,
  onSaveLap,
  onDeleteLap,
}: Props) {
  return (
    <div className="space-y-6">
      <section className={sectionClass}>
        <h2 className="font-display text-lg font-semibold text-white mb-4">ADD LAP TIME</h2>
        <p className="text-f1-muted text-xs mb-4">Format: mm:ss.xxx (e.g. 1:23.456). Driver: type or pick from existing.</p>
        <form onSubmit={onCreateLap} className="flex flex-wrap gap-3 mb-6">
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

      <section className={sectionClass}>
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
                        <td className="py-1.5 pr-4" colSpan={4}>
                          <form onSubmit={onSaveLap} className="flex flex-wrap items-center gap-3 py-1">
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
                            <button type="button" onClick={onCancelEditLap} className="px-2 py-1 border border-f1-border text-f1-muted text-xs rounded hover:text-white">Cancel</button>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td className="py-2.5 pr-4 text-white">{lap.driver_name}</td>
                          <td className="py-2.5 pr-4 font-mono text-white">{lap.lap_time}</td>
                          <td className="py-2.5 pr-4 text-f1-muted">{lap.track_name || '-'}</td>
                          <td className="py-2.5 text-right">
                            <button type="button" onClick={() => onStartEditLap(lap)} className="text-amber-400 hover:text-amber-300 text-sm mr-2">Edit</button>
                            <button type="button" onClick={() => onDeleteLap(lap.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
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
  );
}
