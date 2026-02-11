'use client';

import type { Track } from '@/lib/api';

type Props = {
  tracks: Track[];
  loading: boolean;
  newTrackName: string;
  setNewTrackName: (v: string) => void;
  newTrackCountry: string;
  setNewTrackCountry: (v: string) => void;
  trackOutlineTrackIds: number[];
  trackOutlineUploadingId: number | null;
  trackOutlineInputKeys: Record<number, number>;
  trackOutlineDeletingId: number | null;
  editingTrackId: number | null;
  editTrackName: string;
  setEditTrackName: (v: string) => void;
  editTrackCountry: string;
  setEditTrackCountry: (v: string) => void;
  onCreateTrack: (e: React.FormEvent) => Promise<void>;
  onDeleteTrack: (id: number) => Promise<void>;
  onStartEditTrack: (track: Track) => void;
  onCancelEditTrack: () => void;
  onSaveTrack: (e: React.FormEvent) => Promise<void>;
  onTrackOutlineUpload: (trackId: number, e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onTrackOutlineDelete: (trackId: number) => Promise<void>;
};

const sectionClass = 'bg-f1-panel border border-f1-border rounded-xl p-6';

export function AdminTracksTab({
  tracks,
  loading,
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
  onCreateTrack,
  onDeleteTrack,
  onStartEditTrack,
  onCancelEditTrack,
  onSaveTrack,
  onTrackOutlineUpload,
  onTrackOutlineDelete,
}: Props) {
  return (
    <section className={sectionClass}>
      <h2 className="font-display text-lg font-semibold text-white mb-4">TRACKS</h2>
      <p className="text-f1-muted text-sm mb-4">Add, edit, or delete tracks. Upload a PNG outline per track for fullscreen background when that track is the only one selected.</p>
      <form onSubmit={onCreateTrack} className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Track name" value={newTrackName} onChange={(e) => setNewTrackName(e.target.value)} className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[140px]" />
        <input type="text" placeholder="Country" value={newTrackCountry} onChange={(e) => setNewTrackCountry(e.target.value)} className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]" />
        <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Add track</button>
      </form>
      {loading ? (
        <p className="text-f1-muted text-sm">Loading...</p>
      ) : tracks.length === 0 ? (
        <p className="text-f1-muted text-sm">No tracks yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {tracks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 py-2 border-b border-f1-border last:border-0">
              {editingTrackId === t.id ? (
                <form onSubmit={onSaveTrack} className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editTrackName}
                    onChange={(e) => setEditTrackName(e.target.value)}
                    placeholder="Track name"
                    className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]"
                  />
                  <input
                    type="text"
                    value={editTrackCountry}
                    onChange={(e) => setEditTrackCountry(e.target.value)}
                    placeholder="Country"
                    className="bg-f1-dark border border-f1-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[100px]"
                  />
                  <button type="submit" className="px-2 py-1.5 bg-f1-red text-white text-sm font-medium rounded-lg hover:bg-red-600">Save</button>
                  <button type="button" onClick={onCancelEditTrack} className="px-2 py-1.5 border border-f1-border text-f1-muted text-sm rounded-lg hover:text-white">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="text-white">{t.name} <span className="text-f1-muted">({t.country})</span></span>
                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <span className="flex items-center gap-2 text-f1-muted">
                      {trackOutlineTrackIds.includes(t.id) ? (
                        <>
                          <span className="text-green-400/90 text-xs">Outline</span>
                          <label className="inline-block px-2 py-1 border border-f1-border rounded text-white text-xs font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
                            <input
                              key={`outline-${t.id}-${trackOutlineInputKeys[t.id] ?? 0}`}
                              type="file"
                              accept=".png,image/png"
                              onChange={(ev) => onTrackOutlineUpload(t.id, ev)}
                              disabled={trackOutlineUploadingId !== null}
                              className="hidden"
                            />
                            {trackOutlineUploadingId === t.id ? 'Uploading…' : 'Replace'}
                          </label>
                          <button
                            type="button"
                            onClick={() => onTrackOutlineDelete(t.id)}
                            disabled={trackOutlineDeletingId !== null}
                            className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                          >
                            {trackOutlineDeletingId === t.id ? 'Deleting…' : 'Delete PNG'}
                          </button>
                        </>
                      ) : (
                        <label className="inline-block px-2 py-1 border border-f1-border rounded text-white text-xs font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
                          <input
                            key={`outline-${t.id}-${trackOutlineInputKeys[t.id] ?? 0}`}
                            type="file"
                            accept=".png,image/png"
                            onChange={(ev) => onTrackOutlineUpload(t.id, ev)}
                            disabled={trackOutlineUploadingId !== null}
                            className="hidden"
                          />
                          {trackOutlineUploadingId === t.id ? 'Uploading…' : 'Upload PNG'}
                        </label>
                      )}
                    </span>
                    <span className="text-f1-border">|</span>
                    <span className="flex items-center gap-2">
                      <button type="button" onClick={() => onStartEditTrack(t)} className="text-amber-400 hover:text-amber-300 text-sm">Edit</button>
                      <button type="button" onClick={() => onDeleteTrack(t.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
