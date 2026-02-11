'use client';

type Props = {
  exporting: boolean;
  importing: boolean;
  onExport: () => Promise<void>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
};

const sectionClass = 'bg-f1-panel border border-f1-border rounded-xl p-6';

export function AdminBackupTab({ exporting, importing, onExport, onImport }: Props) {
  return (
    <section className={sectionClass}>
      <h2 className="font-display text-lg font-semibold text-white mb-4">DATABASE BACKUP</h2>
      <p className="text-f1-muted text-sm mb-4">
        Export all tracks, lap times, and dashboard selection to JSON. Import replaces the current database.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={onExport} disabled={exporting} className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
          {exporting ? 'Exporting…' : 'Export database'}
        </button>
        <label className="px-4 py-2 border border-f1-border rounded-lg text-white font-medium cursor-pointer hover:bg-f1-panel transition-colors disabled:opacity-50">
          <input type="file" accept=".json,application/json" onChange={onImport} disabled={importing} className="hidden" />
          {importing ? 'Importing…' : 'Import database'}
        </label>
      </div>
    </section>
  );
}
