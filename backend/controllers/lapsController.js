const { getDb } = require('../database');

function getAllLaps(req, res) {
  try {
    const db = getDb();
    const trackId = req.query.track_id;
    let driverName = req.query.driver_name;
    if (Array.isArray(driverName)) driverName = driverName[0];
    if (typeof driverName === 'string') driverName = driverName.trim();
    if (!driverName) driverName = null;
    const driverNameParam = driverName ? decodeURIComponent(driverName) : null;

    let laps;
    if (trackId && driverNameParam) {
      laps = db.prepare(`
        SELECT l.*, t.name as track_name, t.country
        FROM laps l
        JOIN tracks t ON l.track_id = t.id
        WHERE l.track_id = ? AND l.driver_name = ?
        ORDER BY l.lap_time
      `).all(trackId, driverNameParam);
    } else if (trackId) {
      laps = db.prepare(`
        SELECT l.*, t.name as track_name, t.country
        FROM laps l
        JOIN tracks t ON l.track_id = t.id
        WHERE l.track_id = ?
        ORDER BY l.lap_time
      `).all(trackId);
    } else if (driverNameParam) {
      laps = db.prepare(`
        SELECT l.*, t.name as track_name, t.country
        FROM laps l
        JOIN tracks t ON l.track_id = t.id
        WHERE l.driver_name = ?
        ORDER BY l.track_id, l.lap_time
      `).all(driverNameParam);
    } else {
      laps = db.prepare(`
        SELECT l.*, t.name as track_name, t.country
        FROM laps l
        JOIN tracks t ON l.track_id = t.id
        ORDER BY l.track_id, l.lap_time
      `).all();
    }
    res.json(laps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getDisabledDriverNames(db) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('disabled_driver_names');
  if (!row || !row.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map((n) => String(n).trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function getFastestLapsByTrack(req, res) {
  try {
    const db = getDb();
    const trackId = req.params.trackId;
    let laps = db.prepare(`
      SELECT l.id, l.driver_name, l.lap_time, l.track_id, l.created_at
      FROM laps l
      WHERE l.track_id = ?
      ORDER BY l.lap_time ASC
    `).all(trackId);
    const disabled = getDisabledDriverNames(db);
    if (disabled.length > 0) {
      const set = new Set(disabled);
      laps = laps.filter((lap) => !set.has(lap.driver_name));
    }
    res.json(laps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function createLap(req, res) {
  try {
    const db = getDb();
    const { driver_name, lap_time, track_id } = req.body;
    if (!driver_name || !lap_time || !track_id) {
      return res.status(400).json({ error: 'driver_name, lap_time and track_id are required' });
    }
    const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(track_id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    const result = db.prepare('INSERT INTO laps (driver_name, lap_time, track_id) VALUES (?, ?, ?)')
      .run(driver_name, lap_time, track_id);
    const id = result.lastInsertRowid;
    let lap = db.prepare('SELECT l.*, t.name as track_name FROM laps l JOIN tracks t ON l.track_id = t.id WHERE l.id = ?')
      .get(id);
    if (!lap) {
      lap = { id, driver_name, lap_time, track_id, created_at: new Date().toISOString(), track_name: null };
    }
    res.status(201).json(lap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function updateLap(req, res) {
  try {
    const db = getDb();
    const lapId = req.params.id;
    const existing = db.prepare('SELECT id FROM laps WHERE id = ?').get(lapId);
    if (!existing) return res.status(404).json({ error: 'Lap not found' });
    const { driver_name, lap_time } = req.body;
    const updates = [];
    const params = [];
    if (driver_name !== undefined) {
      if (!String(driver_name).trim()) return res.status(400).json({ error: 'driver_name cannot be empty' });
      updates.push('driver_name = ?');
      params.push(String(driver_name).trim());
    }
    if (lap_time !== undefined) {
      if (!String(lap_time).trim()) return res.status(400).json({ error: 'lap_time cannot be empty' });
      updates.push('lap_time = ?');
      params.push(String(lap_time).trim());
    }
    if (updates.length === 0) {
      const lap = db.prepare(`
        SELECT l.*, t.name as track_name FROM laps l JOIN tracks t ON l.track_id = t.id WHERE l.id = ?
      `).get(lapId);
      return res.json(lap);
    }
    params.push(lapId);
    db.prepare(`UPDATE laps SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const lap = db.prepare(`
      SELECT l.*, t.name as track_name FROM laps l JOIN tracks t ON l.track_id = t.id WHERE l.id = ?
    `).get(lapId);
    res.json(lap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function deleteLap(req, res) {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM laps WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Lap not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function deleteLapsByDriver(req, res) {
  try {
    const db = getDb();
    let driverName = req.query.driver_name;
    if (Array.isArray(driverName)) driverName = driverName[0];
    if (typeof driverName !== 'string' || !driverName.trim()) {
      return res.status(400).json({ error: 'driver_name query is required' });
    }
    driverName = decodeURIComponent(driverName.trim());
    const result = db.prepare('DELETE FROM laps WHERE driver_name = ?').run(driverName);
    res.json({ deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAllLaps, getFastestLapsByTrack, createLap, updateLap, deleteLap, deleteLapsByDriver };
