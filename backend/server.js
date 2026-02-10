const express = require('express');
const cors = require('cors');
const { initDatabase, getDb } = require('./database');
const tracksRouter = require('./routes/tracks');
const lapsRouter = require('./routes/laps');
const configRouter = require('./routes/config');
const exportImportRouter = require('./routes/exportImport');
const telemetryRouter = require('./routes/telemetry');
const telemetryService = require('./udp/telemetryService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
// Allow larger JSON payloads for track outline image uploads (base64)
app.use(express.json({ limit: '10mb' }));

app.use('/api/tracks', tracksRouter);
app.use('/api/laps', lapsRouter);
app.use('/api/config', configRouter);
app.use('/api/database', exportImportRouter);
app.use('/api/telemetry', telemetryRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

function getUdpConfig() {
  try {
    const db = getDb();
    const addrRow = db.prepare('SELECT value FROM config WHERE key = ?').get('udp_telemetry_bind_address');
    const portRow = db.prepare('SELECT value FROM config WHERE key = ?').get('udp_telemetry_port');
    const bindAddress = (addrRow && addrRow.value) ? String(addrRow.value).trim() : '0.0.0.0';
    let port = portRow && portRow.value ? parseInt(portRow.value, 10) : 20777;
    if (Number.isNaN(port) || port < 1024 || port > 65535) port = 20777;
    return { bindAddress, port };
  } catch (_) {
    return { bindAddress: '0.0.0.0', port: 20777 };
  }
}

async function start() {
  await initDatabase();
  telemetryService.start(getUdpConfig);
  app.listen(PORT, () => {
    console.log(`F1 Timing API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
