'use client';

type Props = {
  udpBindAddress: string;
  setUdpBindAddress: (v: string) => void;
  udpPort: number;
  setUdpPort: (v: number) => void;
  udpDriverAlias: string;
  setUdpDriverAlias: (v: string) => void;
  onSaveUdpTelemetry: (e: React.FormEvent) => Promise<void>;
  onSaveUdpDriverAlias: (e: React.FormEvent) => Promise<void>;
};

const sectionClass = 'bg-f1-panel border border-f1-border rounded-xl p-6';

export function AdminTelemetryTab({
  udpBindAddress,
  setUdpBindAddress,
  udpPort,
  setUdpPort,
  udpDriverAlias,
  setUdpDriverAlias,
  onSaveUdpTelemetry,
  onSaveUdpDriverAlias,
}: Props) {
  return (
    <section className={sectionClass}>
      <h2 className="font-display text-lg font-semibold text-white mb-4">F1 25 UDP TELEMETRY</h2>
      <p className="text-f1-muted text-sm mb-4">
        IP and port the backend listens on. Set the same port in the game UDP settings (e.g. 20777). Bind 0.0.0.0 = all interfaces. Save restarts the listener.
      </p>
      <form onSubmit={onSaveUdpTelemetry} className="flex flex-wrap items-center gap-3">
        <label className="text-f1-muted text-sm">
          Bind address
          <input type="text" value={udpBindAddress} onChange={(e) => setUdpBindAddress(e.target.value)} placeholder="0.0.0.0" className="ml-2 bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[120px]" />
        </label>
        <label className="text-f1-muted text-sm">
          Port
          <input type="number" min={1024} max={65535} value={udpPort} onChange={(e) => setUdpPort(Number(e.target.value) || 20777)} className="ml-2 bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-f1-red w-24" />
        </label>
        <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Save & restart listener</button>
      </form>
      <div className="mt-6 pt-6 border-t border-f1-border">
        <p className="text-f1-muted text-sm mb-3">Display name in live telemetry view (overrides game name). Leave empty to use game name.</p>
        <form onSubmit={onSaveUdpDriverAlias} className="flex flex-wrap items-center gap-3">
          <input type="text" value={udpDriverAlias} onChange={(e) => setUdpDriverAlias(e.target.value)} placeholder="e.g. Max, Player 1" className="bg-f1-dark border border-f1-border rounded-lg px-4 py-2 text-white placeholder-f1-muted focus:outline-none focus:ring-2 focus:ring-f1-red min-w-[180px]" />
          <button type="submit" className="px-4 py-2 bg-f1-red text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Save alias</button>
        </form>
      </div>
    </section>
  );
}
