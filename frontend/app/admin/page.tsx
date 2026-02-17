'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TABS, type AdminTab } from './constants';
import { useAdminData } from './hooks/useAdminData';
import {
  AdminDashboardTab,
  AdminTelemetryTab,
  AdminUpdatesTab,
  AdminTracksTab,
  AdminLapsTab,
  AdminBackupTab,
} from './components';

const VALID_TABS: AdminTab[] = ['dashboard', 'telemetry', 'updates', 'tracks', 'laps', 'backup'];

function AdminPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const data = useAdminData();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.includes(tab as AdminTab)) {
      setActiveTab(tab as AdminTab);
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-f1-dark p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <Link
          href="/"
          className="font-display text-xl md:text-2xl font-bold text-white hover:text-f1-red transition-colors"
        >
          F1 TIMING
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/admin/drivers" className="text-sm text-f1-muted hover:text-f1-text transition-colors">
            Drivers
          </Link>
          <Link href="/display" className="text-sm text-f1-muted hover:text-f1-text transition-colors" target="_blank" rel="noopener noreferrer">
            Display
          </Link>
          <Link href="/dashboard" className="text-sm text-f1-muted hover:text-f1-text transition-colors" target="_blank" rel="noopener noreferrer">
            Dashboard
          </Link>
          <Link href="/carousel" className="text-sm text-f1-muted hover:text-f1-text transition-colors" target="_blank" rel="noopener noreferrer">
            Carousel
          </Link>
          {data.apiBase && (
            <span className="text-xs text-f1-muted font-mono" title="API base URL">
              API: {data.apiBase.replace(/\/api\/?$/, '')}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-6 py-3 px-4 mb-6 rounded-xl bg-f1-panel/60 border border-f1-border">
        <span className="text-f1-muted text-sm">
          <strong className="text-white">{data.tracks.length}</strong> tracks
        </span>
        <span className="text-f1-muted text-sm">
          <strong className="text-white">{data.laps.length}</strong> lap times
        </span>
        <span className="text-f1-muted text-sm">
          Dashboard: <strong className={data.dashboardUp ? 'text-green-400' : 'text-amber-400'}>{data.dashboardUp ? 'UP' : 'DOWN'}</strong>
        </span>
      </div>

      <nav className="flex gap-1 mb-6 border-b border-f1-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-f1-panel border border-f1-border border-b-0 text-white -mb-px'
                : 'text-f1-muted hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="max-w-4xl mx-auto space-y-6">
        {data.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {data.error}
          </div>
        )}
        {data.success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {data.success}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <AdminDashboardTab
            tracks={data.tracks}
            dashboardTrackIds={data.dashboardTrackIds}
            dashboardTitle={data.dashboardTitle}
            setDashboardTitleState={data.setDashboardTitleState}
            dashboardUp={data.dashboardUp}
            carouselIntervalSec={data.carouselIntervalSec}
            setCarouselIntervalSec={data.setCarouselIntervalSec}
            displayView={data.displayView}
            setDashboardTrackInSlot={data.setDashboardTrackInSlot}
            addDashboardTrackSlot={data.addDashboardTrackSlot}
            setDashboardTrackShowAll={data.setDashboardTrackShowAll}
            setDashboardTrackHideAll={data.setDashboardTrackHideAll}
            removeDashboardTrackSlot={data.removeDashboardTrackSlot}
            onSaveDashboardTracks={data.handleSaveDashboardTracks}
            onSaveDashboardTitle={data.handleSaveDashboardTitle}
            onSetDashboardUp={data.handleSetDashboardUp}
            onSaveCarouselInterval={data.handleSaveCarouselInterval}
            onSetDisplayView={data.handleSetDisplayView}
          />
        )}

        {activeTab === 'updates' && <AdminUpdatesTab />}

        {activeTab === 'telemetry' && (
          <AdminTelemetryTab
            udpBindAddress={data.udpBindAddress}
            setUdpBindAddress={data.setUdpBindAddress}
            udpPort={data.udpPort}
            setUdpPort={data.setUdpPort}
            udpDriverAlias={data.udpDriverAlias}
            setUdpDriverAlias={data.setUdpDriverAlias}
            onSaveUdpTelemetry={data.handleSaveUdpTelemetry}
            onSaveUdpDriverAlias={data.handleSaveUdpDriverAlias}
          />
        )}

        {activeTab === 'tracks' && (
          <AdminTracksTab
            tracks={data.tracks}
            loading={data.loading}
            newTrackName={data.newTrackName}
            setNewTrackName={data.setNewTrackName}
            newTrackCountry={data.newTrackCountry}
            setNewTrackCountry={data.setNewTrackCountry}
            trackOutlineTrackIds={data.trackOutlineTrackIds}
            trackOutlineUploadingId={data.trackOutlineUploadingId}
            trackOutlineInputKeys={data.trackOutlineInputKeys}
            trackOutlineDeletingId={data.trackOutlineDeletingId}
            editingTrackId={data.editingTrackId}
            editTrackName={data.editTrackName}
            setEditTrackName={data.setEditTrackName}
            editTrackCountry={data.editTrackCountry}
            setEditTrackCountry={data.setEditTrackCountry}
            onCreateTrack={data.handleCreateTrack}
            onDeleteTrack={data.handleDeleteTrack}
            onStartEditTrack={data.startEditTrack}
            onCancelEditTrack={data.cancelEditTrack}
            onSaveTrack={data.handleSaveTrack}
            onTrackOutlineUpload={data.handleTrackOutlineUpload}
            onTrackOutlineDelete={data.handleTrackOutlineDelete}
          />
        )}

        {activeTab === 'laps' && (
          <AdminLapsTab
            tracks={data.tracks}
            laps={data.laps}
            loading={data.loading}
            newLapDriver={data.newLapDriver}
            setNewLapDriver={data.setNewLapDriver}
            newLapTime={data.newLapTime}
            setNewLapTime={data.setNewLapTime}
            newLapTrackId={data.newLapTrackId}
            setNewLapTrackId={data.setNewLapTrackId}
            lapFilterTrackId={data.lapFilterTrackId}
            setLapFilterTrackId={data.setLapFilterTrackId}
            lapFilterDriver={data.lapFilterDriver}
            setLapFilterDriver={data.setLapFilterDriver}
            uniqueDriverNames={data.uniqueDriverNames}
            filteredLaps={data.filteredLaps}
            editingLapId={data.editingLapId}
            editDriver={data.editDriver}
            setEditDriver={data.setEditDriver}
            editLapTime={data.editLapTime}
            setEditLapTime={data.setEditLapTime}
            onCreateLap={data.handleCreateLap}
            onStartEditLap={data.startEditLap}
            onCancelEditLap={data.cancelEditLap}
            onSaveLap={data.handleSaveLap}
            onDeleteLap={data.handleDeleteLap}
          />
        )}

        {activeTab === 'backup' && (
          <AdminBackupTab
            exporting={data.exporting}
            importing={data.importing}
            onExport={data.handleExport}
            onImport={data.handleImport}
          />
        )}
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-f1-dark p-4 md:p-8 flex items-center justify-center">
          <p className="text-f1-muted">Loading…</p>
        </main>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
