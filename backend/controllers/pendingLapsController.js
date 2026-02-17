const { getDb } = require('../database');

/** Convert ms to lap_time string m:ss.xxx */
function lapTimeMsToString(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '0:00.000';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secs = Math.floor(seconds);
  const millis = Math.round((seconds % 1) * 1000);
  return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function list(req, res) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, track_name, lap_time_ms, lap_time, driver_name, suggested_at
      FROM pending_lap_updates
      ORDER BY suggested_at DESC
    `).all();
    const out = [];
    for (const row of rows) {
      const track = db.prepare('SELECT id FROM tracks WHERE LOWER(TRIM(name)) = LOWER(?)').get(row.track_name);
      let previous_lap_time = null;
      if (track) {
        const driverTrim = (row.driver_name || '').trim();
        const lap = db.prepare(`
          SELECT lap_time FROM laps
          WHERE track_id = ?
          AND (
            LOWER(TRIM(driver_name)) = LOWER(?)
            OR LOWER(TRIM(driver_name)) LIKE LOWER(?) || ' %'
            OR LOWER(?) LIKE LOWER(TRIM(driver_name)) || ' %'
          )
          ORDER BY lap_time ASC LIMIT 1
        `).get(track.id, driverTrim, driverTrim, driverTrim);
        if (lap) previous_lap_time = lap.lap_time;
      }
      if (previous_lap_time != null && previous_lap_time === row.lap_time) {
        db.prepare('DELETE FROM pending_lap_updates WHERE id = ?').run(row.id);
        continue;
      }
      out.push({ ...row, previous_lap_time });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function create(req, res) {
  try {
    const { trackName, lapTimeMs, driverName } = req.body;
    if (typeof trackName !== 'string' || !trackName.trim()) {
      return res.status(400).json({ error: 'trackName is required' });
    }
    const lapMs = typeof lapTimeMs === 'number' ? lapTimeMs : parseInt(lapTimeMs, 10);
    if (Number.isNaN(lapMs) || lapMs <= 0) {
      return res.status(400).json({ error: 'lapTimeMs must be a positive number' });
    }
    const driver = typeof driverName === 'string' ? driverName.trim() : '';
    const db = getDb();
    const track = trackName.trim();
    const lapTime = lapTimeMsToString(lapMs);
    const name = driver || 'Driver';

    const trackRow = db.prepare('SELECT id FROM tracks WHERE LOWER(TRIM(name)) = LOWER(?)').get(track);
    if (trackRow) {
      const driverTrim = name;
      const currentLap = db.prepare(`
        SELECT lap_time FROM laps
        WHERE track_id = ?
        AND (
          LOWER(TRIM(driver_name)) = LOWER(?)
          OR LOWER(TRIM(driver_name)) LIKE LOWER(?) || ' %'
          OR LOWER(?) LIKE LOWER(TRIM(driver_name)) || ' %'
        )
        ORDER BY lap_time ASC LIMIT 1
      `).get(trackRow.id, driverTrim, driverTrim, driverTrim);
      if (currentLap && currentLap.lap_time === lapTime) {
        const existingPending = db.prepare(
          'SELECT id, track_name, lap_time_ms, lap_time, driver_name, suggested_at FROM pending_lap_updates WHERE LOWER(TRIM(track_name)) = LOWER(?) AND LOWER(TRIM(driver_name)) = LOWER(?) LIMIT 1'
        ).get(track, name);
        return res.status(200).json(existingPending || { skipped: true, lap_time: lapTime });
      }
    }

    const existing = db.prepare(
      'SELECT id, lap_time_ms FROM pending_lap_updates WHERE LOWER(TRIM(track_name)) = LOWER(?) AND LOWER(TRIM(driver_name)) = LOWER(?) LIMIT 1'
    ).get(track, name);

    if (existing) {
      if (lapMs < existing.lap_time_ms) {
        db.prepare('DELETE FROM pending_lap_updates WHERE id = ?').run(existing.id);
        const result = db.prepare(
          'INSERT INTO pending_lap_updates (track_name, lap_time_ms, lap_time, driver_name) VALUES (?, ?, ?, ?)'
        ).run(track, lapMs, lapTime, name);
        const id = result.lastInsertRowid;
        const row = db.prepare('SELECT id, track_name, lap_time_ms, lap_time, driver_name, suggested_at FROM pending_lap_updates WHERE id = ?').get(id);
        return res.status(201).json(row);
      }
      const row = db.prepare('SELECT id, track_name, lap_time_ms, lap_time, driver_name, suggested_at FROM pending_lap_updates WHERE id = ?').get(existing.id);
      return res.status(200).json(row);
    }

    const result = db.prepare(
      'INSERT INTO pending_lap_updates (track_name, lap_time_ms, lap_time, driver_name) VALUES (?, ?, ?, ?)'
    ).run(track, lapMs, lapTime, name);
    const id = result.lastInsertRowid;
    const row = db.prepare('SELECT id, track_name, lap_time_ms, lap_time, driver_name, suggested_at FROM pending_lap_updates WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { driverName } = req.body;
    const name = typeof driverName === 'string' ? driverName.trim() : '';
    const db = getDb();
    const existing = db.prepare('SELECT id FROM pending_lap_updates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Pending lap not found' });
    }
    db.prepare('UPDATE pending_lap_updates SET driver_name = ? WHERE id = ?').run(name || 'Driver', id);
    const row = db.prepare('SELECT id, track_name, lap_time_ms, lap_time, driver_name, suggested_at FROM pending_lap_updates WHERE id = ?').get(id);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const db = getDb();
    const result = db.prepare('DELETE FROM pending_lap_updates WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pending lap not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function confirm(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const db = getDb();
    const row = db.prepare('SELECT id, track_name, lap_time_ms, lap_time, driver_name FROM pending_lap_updates WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Pending lap not found' });
    }
    const track = db.prepare('SELECT id, name FROM tracks WHERE LOWER(TRIM(name)) = LOWER(?)').get(row.track_name);
    if (!track) {
      return res.status(400).json({ error: `Track "${row.track_name}" not found. Create the track in Admin first.` });
    }
    const driverTrim = (row.driver_name || '').trim();
    db.prepare(`
      DELETE FROM laps WHERE track_id = ?
      AND (
        LOWER(TRIM(driver_name)) = LOWER(?)
        OR LOWER(TRIM(driver_name)) LIKE LOWER(?) || ' %'
        OR LOWER(?) LIKE LOWER(TRIM(driver_name)) || ' %'
      )
    `).run(track.id, driverTrim, driverTrim, driverTrim);
    db.prepare('INSERT INTO laps (driver_name, lap_time, track_id) VALUES (?, ?, ?)').run(row.driver_name, row.lap_time, track.id);
    db.prepare('DELETE FROM pending_lap_updates WHERE id = ?').run(id);
    res.json({ ok: true, message: 'Lap added to times.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, create, update, remove, confirm };
