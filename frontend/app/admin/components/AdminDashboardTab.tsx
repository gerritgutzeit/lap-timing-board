'use client';

import { MAX_DASHBOARD_TRACKS } from '../constants';

type Props = {
  tracks: { id: number; name: string; country: string }[];
  dashboardTrackIds: string[];
  dashboardTitle: string;
  setDashboardTitleState: (v: string) => void;
  dashboardUp: boolean;
  carouselIntervalSec: number;
  setCarouselIntervalSec: (v: number) => void;
  displayView: 'dashboard' | 'carousel';
  setDashboardTrackInSlot: (slotIndex: number, value: string) => void;
  addDashboardTrackSlot: () => void;
  setDashboardTrackShowAll: () => void;
  setDashboardTrackHideAll: () => void;
  removeDashboardTrackSlot: (slotIndex: number) => void;
  onSaveDashboardTracks: () => Promise<void>;
  onSaveDashboardTitle: (e: React.FormEvent) => Promise<void>;
  onSetDashboardUp: (up: boolean) => Promise<void>;
  onSaveCarouselInterval: (e: React.FormEvent) => Promise<void>;
  onSetDisplayView: (view: 'dashboard' | 'carousel') => Promise<void>;
};

const sectionClass = 'bg-f1-panel border border-f1-border rounded-xl p-6';

export function AdminDashboardTab({
  tracks,
  dashboardTrackIds,
  dashboardTitle,
  setDashboardTitleState,
  dashboardUp,
  carouselIntervalSec,
  setCarouselIntervalSec,
  displayView,
  setDashboardTrackInSlot,
  addDashboardTrackSlot,
  setDashboardTrackShowAll,
  setDashboardTrackHideAll,
  removeDashboardTrackSlot,
  onSaveDashboardTracks,
  onSaveDashboardTitle,
  onSetDashboardUp,
  onSaveCarouselInterval,
  onSetDisplayView,
}: Props) {
  return (
    <div className="space-y-6">
      <section className={sectionClass}>
        <h2 className="font-display text-lg font-semibold text-white mb-4">DISPLAY VIEW</h2>
        <p className="text-f1-muted text-sm mb-4">Choose what the display page shows. Open /display to view the selected mode (e.g. on a second screen).</p>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className="text-f1-muted text-sm">Show:</span>
          <div className="flex rounded-lg border border-f1-border overflow-hidden">
            <button
              type="button"
              onClick={() => onSetDisplayView('dashboard')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                displayView === 'dashboard'
                  ? 'bg-f1-red text-white'
                  : 'bg-f1-dark text-f1-muted hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onSetDisplayView('carousel')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                displayView === 'carousel'
                  ? 'bg-f1-red text-white'
                  : 'bg-f1-dark text-f1-muted hover:text-white'
              }`}
            >
              Carousel
            </button>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display text-lg font-semibold text-white mb-4">DASHBOARD HEADLINE</h2>
        <p className="text-f1-muted text-sm mb-4">Main title on the dashboard. Save to apply.</p>
        <form onSubmit={onSaveDashboardTitle} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={dashboardTitle}
            onChange={(e) => setDashboardTitleState(e.target.value)}
            placeholder="F1 TIMING"
            className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[200px]"
          />
          <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
            Save headline
          </button>
        </form>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display text-lg font-semibold text-white mb-4">DASHBOARD STATUS</h2>
        <p className="text-f1-muted text-sm mb-4">When DOWN, visitors see fullscreen status (TIME, DATE, STATUS ERROR).</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-white font-medium">Dashboard is {dashboardUp ? 'UP' : 'DOWN'}</span>
          <button
            type="button"
            onClick={() => onSetDashboardUp(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${dashboardUp ? 'bg-green-600 text-white' : 'border border-f1-border text-f1-muted hover:text-white'}`}
          >
            Set UP
          </button>
          <button
            type="button"
            onClick={() => onSetDashboardUp(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${!dashboardUp ? 'bg-amber-600 text-white' : 'border border-f1-border text-f1-muted hover:text-white'}`}
          >
            Set DOWN
          </button>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display text-lg font-semibold text-white mb-4">CAROUSEL INTERVAL</h2>
        <p className="text-f1-muted text-sm mb-4">Seconds per slide on Carousel page (3–120). Save to apply.</p>
        <form onSubmit={onSaveCarouselInterval} className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={3}
            max={120}
            value={carouselIntervalSec}
            onChange={(e) => setCarouselIntervalSec(Number(e.target.value) || 10)}
            className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red w-24"
          />
          <span className="text-f1-muted text-sm">seconds per slide</span>
          <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
            Save interval
          </button>
        </form>
      </section>

      <section className={sectionClass}>
        <h2 className="font-display text-lg font-semibold text-white mb-4">DASHBOARD TRACK SELECTION</h2>
        <p className="text-f1-muted text-sm mb-4">Choose which tracks appear on the dashboard. Save to apply.</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {dashboardTrackIds.map((trackId, slotIndex) => {
            const selectedInOtherSlots = dashboardTrackIds.filter((id, i) => i !== slotIndex && id);
            const availableTracks = trackId
              ? tracks.filter((t) => String(t.id) === trackId || !selectedInOtherSlots.includes(String(t.id)))
              : tracks.filter((t) => !dashboardTrackIds.filter(Boolean).includes(String(t.id)));
            return trackId ? (
              <div key={`${slotIndex}-${trackId}`} className="flex items-center gap-2">
                <select
                  value={trackId}
                  onChange={(e) => setDashboardTrackInSlot(slotIndex, e.target.value)}
                  className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[180px]"
                >
                  <option value="">Select track</option>
                  {availableTracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.country}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeDashboardTrackSlot(slotIndex)} className="text-red-400 hover:text-red-300 text-sm" aria-label="Remove">✕</button>
              </div>
            ) : (
              <div key={`add-${slotIndex}`} className="flex items-center gap-2">
                <select
                  value=""
                  onChange={(e) => setDashboardTrackInSlot(slotIndex, e.target.value)}
                  className="bg-f1-dark border border-f1-border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[180px]"
                >
                  <option value="">Select track</option>
                  {availableTracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.country}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {dashboardTrackIds.length < MAX_DASHBOARD_TRACKS && dashboardTrackIds.every(Boolean) && (
            <button type="button" onClick={addDashboardTrackSlot} className="px-3 py-2 border border-dashed border-f1-border rounded-lg text-f1-muted hover:text-white text-sm">
              + Add track
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={setDashboardTrackShowAll} disabled={tracks.length === 0} className="px-3 py-2 border border-f1-border rounded-lg text-f1-muted hover:text-white text-sm disabled:opacity-50">
            Show all
          </button>
          <button type="button" onClick={setDashboardTrackHideAll} className="px-3 py-2 border border-f1-border rounded-lg text-f1-muted hover:text-white text-sm">
            Hide all
          </button>
          <button type="button" onClick={onSaveDashboardTracks} className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
