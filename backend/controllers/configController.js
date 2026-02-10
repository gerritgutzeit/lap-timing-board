const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');

const DASHBOARD_TRACK_IDS_KEY = 'dashboard_track_ids';
const DASHBOARD_TITLE_KEY = 'dashboard_title';
const DEFAULT_TITLE = 'F1 TIMING';
const DASHBOARD_UP_KEY = 'dashboard_up';
const DISABLED_DRIVER_NAMES_KEY = 'disabled_driver_names';
const CAROUSEL_INTERVAL_MS_KEY = 'carousel_interval_ms';
const DEFAULT_CAROUSEL_INTERVAL_MS = 10000;
const MIN_CAROUSEL_INTERVAL_MS = 3000;
const MAX_CAROUSEL_INTERVAL_MS = 120000;

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

module.exports = { getDashboardTracks, setDashboardTracks, getDashboardTitle, setDashboardTitle, getDashboardUp, setDashboardUp, getDisabledDrivers, setDisabledDrivers, getTrackOutlineImage, setTrackOutlineImage, hasTrackOutline, getTrackOutlineTrackIds, getCarouselInterval, setCarouselInterval };
