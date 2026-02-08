const { getDb } = require('../database');

const DASHBOARD_TRACK_IDS_KEY = 'dashboard_track_ids';

function exportDatabase(req, res) {
  try {
    const db = getDb();
    const tracks = db.prepare('SELECT * FROM tracks ORDER BY id').all();
    const laps = db.prepare('SELECT id, driver_name, lap_time, track_id, created_at FROM laps ORDER BY id').all();
    let dashboardTrackIds = [];
    const configRow = db.prepare('SELECT value FROM config WHERE key = ?').get(DASHBOARD_TRACK_IDS_KEY);
    if (configRow && configRow.value) {
      try {
        const parsed = JSON.parse(configRow.value);
        if (Array.isArray(parsed)) dashboardTrackIds = parsed;
      } catch (_) {}
    }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tracks,
      laps,
      dashboardTrackIds,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="f1-timing-backup.json"');
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function importDatabase(req, res) {
  try {
    const { tracks = [], laps = [], dashboardTrackIds = [] } = req.body;
    if (!Array.isArray(tracks) || !Array.isArray(laps)) {
      return res.status(400).json({ error: 'Invalid backup: tracks and laps must be arrays' });
    }

    const db = getDb();

    db.prepare('DELETE FROM laps').run();
    db.prepare('DELETE FROM tracks').run();
    db.prepare('DELETE FROM config WHERE key = ?').run(DASHBOARD_TRACK_IDS_KEY);

    const oldIdToNewId = {};

    for (const t of tracks) {
      const name = t.name != null ? String(t.name) : '';
      const country = t.country != null ? String(t.country) : '';
      const result = db.prepare('INSERT INTO tracks (name, country) VALUES (?, ?)').run(name, country);
      const newId = result.lastInsertRowid;
      if (t.id != null) oldIdToNewId[Number(t.id)] = newId;
    }

    for (const lap of laps) {
      const oldTrackId = lap.track_id != null ? Number(lap.track_id) : null;
      const newTrackId = oldTrackId != null && oldIdToNewId[oldTrackId] != null
        ? oldIdToNewId[oldTrackId]
        : (tracks.length && oldIdToNewId[tracks[0].id] != null ? oldIdToNewId[tracks[0].id] : null);
      if (newTrackId == null) continue;
      const driver_name = lap.driver_name != null ? String(lap.driver_name) : '';
      const lap_time = lap.lap_time != null ? String(lap.lap_time) : '';
      db.prepare('INSERT INTO laps (driver_name, lap_time, track_id) VALUES (?, ?, ?)')
        .run(driver_name, lap_time, newTrackId);
    }

    const mappedDashboardIds = dashboardTrackIds
      .map((id) => oldIdToNewId[Number(id)])
      .filter((id) => id != null);
    if (mappedDashboardIds.length > 0) {
      db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
        .run(DASHBOARD_TRACK_IDS_KEY, JSON.stringify(mappedDashboardIds));
    }

    res.json({
      success: true,
      tracksCreated: tracks.length,
      lapsCreated: laps.length,
      dashboardTrackIds: mappedDashboardIds,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { exportDatabase, importDatabase };
