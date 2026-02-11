const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const telemetryService = require('../udp/telemetryService');

const DASHBOARD_TRACK_IDS_KEY = 'dashboard_track_ids';
const DASHBOARD_TITLE_KEY = 'dashboard_title';
const DEFAULT_TITLE = 'F1 TIMING';
const DASHBOARD_UP_KEY = 'dashboard_up';
const DISABLED_DRIVER_NAMES_KEY = 'disabled_driver_names';
const CAROUSEL_INTERVAL_MS_KEY = 'carousel_interval_ms';
const DEFAULT_CAROUSEL_INTERVAL_MS = 10000;
const MIN_CAROUSEL_INTERVAL_MS = 3000;
const MAX_CAROUSEL_INTERVAL_MS = 120000;

const DISPLAY_VIEW_KEY = 'display_view';
const DISPLAY_VIEW_DASHBOARD = 'dashboard';
const DISPLAY_VIEW_CAROUSEL = 'carousel';

const UDP_TELEMETRY_BIND_ADDRESS_KEY = 'udp_telemetry_bind_address';
const UDP_TELEMETRY_PORT_KEY = 'udp_telemetry_port';
const UDP_TELEMETRY_DRIVER_ALIAS_KEY = 'udp_telemetry_driver_alias';
const DEFAULT_UDP_BIND_ADDRESS = '0.0.0.0';
const DEFAULT_UDP_PORT = 20777;
const MIN_UDP_PORT = 1024;
const MAX_UDP_PORT = 65535;

const TRACK_OUTLINE_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const TRACK_OUTLINE_PREFIX = 'track-outline-';
const TRACK_OUTLINE_SUFFIX = '.png';

function getTrackOutlinePath(trackId) {
  if (!trackId || !Number.isInteger(Number(trackId))) return null;
  const id = Number(trackId);
  if (id <= 0) return null;
  if (!fs.existsSync(TRACK_OUTLINE_DIR)) fs.mkdirSync(TRACK_OUTLINE_DIR, { recursive: true });
  return path.join(TRACK_OUTLINE_DIR, `${TRACK_OUTLINE_PREFIX}${id}${TRACK_OUTLINE_SUFFIX}`);
}

function getDashboardTracks(req, res) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(DASHBOARD_TRACK_IDS_KEY);
    let trackIds = [];
    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) trackIds = parsed;
      } catch (_) {}
    }
    res.json({ trackIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setDashboardTracks(req, res) {
  try {
    const db = getDb();
    const { trackIds } = req.body;
    if (!Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'trackIds must be an array' });
    }
    const value = JSON.stringify(trackIds.map(Number).filter(Boolean));
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(DASHBOARD_TRACK_IDS_KEY, value);
    res.json({ trackIds: JSON.parse(value) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getDashboardTitle(req, res) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(DASHBOARD_TITLE_KEY);
    const title = (row && row.value) ? String(row.value).trim() : DEFAULT_TITLE;
    res.json({ title: title || DEFAULT_TITLE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setDashboardTitle(req, res) {
  try {
    const db = getDb();
    let { title } = req.body;
    if (title !== undefined) title = String(title).trim();
    const value = title || DEFAULT_TITLE;
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(DASHBOARD_TITLE_KEY, value);
    res.json({ title: value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getDashboardUp(req, res) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(DASHBOARD_UP_KEY);
    const up = row && row.value === 'true';
    res.json({ up: !!up });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setDashboardUp(req, res) {
  try {
    const db = getDb();
    const up = req.body?.up === true || req.body?.up === 'true';
    const value = up ? 'true' : 'false';
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(DASHBOARD_UP_KEY, value);
    res.json({ up: !!up });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getDisabledDrivers(req, res) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(DISABLED_DRIVER_NAMES_KEY);
    let names = [];
    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) names = parsed.map((n) => String(n).trim()).filter(Boolean);
      } catch (_) {}
    }
    res.json({ driverNames: names });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setDisabledDrivers(req, res) {
  try {
    const db = getDb();
    const { driverNames } = req.body;
    if (!Array.isArray(driverNames)) {
      return res.status(400).json({ error: 'driverNames must be an array' });
    }
    const names = driverNames.map((n) => String(n).trim()).filter(Boolean);
    const value = JSON.stringify(names);
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(DISABLED_DRIVER_NAMES_KEY, value);
    res.json({ driverNames: names });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getTrackOutlineImage(req, res) {
  try {
    const trackId = req.params.trackId;
    const filePath = getTrackOutlinePath(trackId);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).send();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setTrackOutlineImage(req, res) {
  try {
    const trackId = req.params.trackId;
    const filePath = getTrackOutlinePath(trackId);
    if (!filePath) return res.status(400).json({ error: 'Invalid track id' });
    const base64 = req.body?.image;
    if (typeof base64 !== 'string' || !base64) {
      return res.status(400).json({ error: 'image (base64) is required' });
    }
    const clean = base64.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(clean, 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'Invalid image data' });
    fs.writeFileSync(filePath, buf);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function hasTrackOutline(req, res) {
  try {
    const trackId = req.params.trackId;
    const filePath = getTrackOutlinePath(trackId);
    res.json({ hasImage: !!filePath && fs.existsSync(filePath) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function deleteTrackOutlineImage(req, res) {
  try {
    const trackId = req.params.trackId;
    const filePath = getTrackOutlinePath(trackId);
    if (!filePath) return res.status(400).json({ error: 'Invalid track id' });
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getTrackOutlineTrackIds(req, res) {
  try {
    if (!fs.existsSync(TRACK_OUTLINE_DIR)) {
      return res.json({ trackIds: [] });
    }
    const files = fs.readdirSync(TRACK_OUTLINE_DIR);
    const trackIds = files
      .filter((f) => f.startsWith(TRACK_OUTLINE_PREFIX) && f.endsWith(TRACK_OUTLINE_SUFFIX))
      .map((f) => parseInt(f.slice(TRACK_OUTLINE_PREFIX.length, -TRACK_OUTLINE_SUFFIX.length), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    res.json({ trackIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getCarouselInterval(req, res) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(CAROUSEL_INTERVAL_MS_KEY);
    const ms = row && row.value ? parseInt(row.value, 10) : DEFAULT_CAROUSEL_INTERVAL_MS;
    const intervalMs = Number.isNaN(ms) || ms < MIN_CAROUSEL_INTERVAL_MS || ms > MAX_CAROUSEL_INTERVAL_MS
      ? DEFAULT_CAROUSEL_INTERVAL_MS
      : ms;
    res.json({ intervalMs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setCarouselInterval(req, res) {
  try {
    const db = getDb();
    let { intervalMs } = req.body;
    intervalMs = parseInt(intervalMs, 10);
    if (Number.isNaN(intervalMs)) {
      return res.status(400).json({ error: 'intervalMs must be a number' });
    }
    const clamped = Math.max(MIN_CAROUSEL_INTERVAL_MS, Math.min(MAX_CAROUSEL_INTERVAL_MS, intervalMs));
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(CAROUSEL_INTERVAL_MS_KEY, String(clamped));
    res.json({ intervalMs: clamped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getDisplayView(req, res) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(DISPLAY_VIEW_KEY);
    const value = (row && row.value) ? String(row.value).trim() : DISPLAY_VIEW_DASHBOARD;
    const view = value === DISPLAY_VIEW_CAROUSEL ? DISPLAY_VIEW_CAROUSEL : DISPLAY_VIEW_DASHBOARD;
    res.json({ view });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setDisplayView(req, res) {
  try {
    const db = getDb();
    let { view } = req.body;
    view = view === DISPLAY_VIEW_CAROUSEL ? DISPLAY_VIEW_CAROUSEL : DISPLAY_VIEW_DASHBOARD;
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(DISPLAY_VIEW_KEY, view);
    res.json({ view });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getUdpTelemetryConfig(req, res) {
  try {
    const db = getDb();
    const addrRow = db.prepare('SELECT value FROM config WHERE key = ?').get(UDP_TELEMETRY_BIND_ADDRESS_KEY);
    const portRow = db.prepare('SELECT value FROM config WHERE key = ?').get(UDP_TELEMETRY_PORT_KEY);
    const address = (addrRow && addrRow.value) ? String(addrRow.value).trim() : DEFAULT_UDP_BIND_ADDRESS;
    let port = portRow && portRow.value ? parseInt(portRow.value, 10) : DEFAULT_UDP_PORT;
    if (Number.isNaN(port) || port < MIN_UDP_PORT || port > MAX_UDP_PORT) port = DEFAULT_UDP_PORT;
    res.json({ bindAddress: address || DEFAULT_UDP_BIND_ADDRESS, port });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setUdpTelemetryConfig(req, res) {
  try {
    const db = getDb();
    let { bindAddress, port } = req.body;
    bindAddress = typeof bindAddress === 'string' ? bindAddress.trim() : '';
    if (!bindAddress) bindAddress = DEFAULT_UDP_BIND_ADDRESS;
    port = parseInt(port, 10);
    if (Number.isNaN(port)) {
      return res.status(400).json({ error: 'port must be a number' });
    }
    const clampedPort = Math.max(MIN_UDP_PORT, Math.min(MAX_UDP_PORT, port));
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(UDP_TELEMETRY_BIND_ADDRESS_KEY, bindAddress);
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(UDP_TELEMETRY_PORT_KEY, String(clampedPort));
    telemetryService.start(() => ({ bindAddress, port: clampedPort }));
    res.json({ bindAddress, port: clampedPort });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getDriverAliasValue() {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(UDP_TELEMETRY_DRIVER_ALIAS_KEY);
    const v = row && row.value ? String(row.value).trim() : '';
    return v || null;
  } catch (_) {
    return null;
  }
}

function getUdpTelemetryDriverAlias(req, res) {
  try {
    const driverAlias = getDriverAliasValue();
    res.json({ driverAlias: driverAlias ?? '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function setUdpTelemetryDriverAlias(req, res) {
  try {
    const db = getDb();
    let { driverAlias } = req.body;
    driverAlias = typeof driverAlias === 'string' ? driverAlias.trim() : '';
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(UDP_TELEMETRY_DRIVER_ALIAS_KEY, driverAlias);
    res.json({ driverAlias });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getDashboardTracks,
  setDashboardTracks,
  getDashboardTitle,
  setDashboardTitle,
  getDashboardUp,
  setDashboardUp,
  getDisabledDrivers,
  setDisabledDrivers,
  getTrackOutlineImage,
  setTrackOutlineImage,
  deleteTrackOutlineImage,
  hasTrackOutline,
  getTrackOutlineTrackIds,
  getCarouselInterval,
  setCarouselInterval,
  getDisplayView,
  setDisplayView,
  getUdpTelemetryConfig,
  setUdpTelemetryConfig,
  getDriverAliasValue,
  getUdpTelemetryDriverAlias,
  setUdpTelemetryDriverAlias,
};
