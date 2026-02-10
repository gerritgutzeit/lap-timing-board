const { getDb } = require('../database');

function getAllTracks(req, res) {
  try {
    const db = getDb();
    const tracks = db.prepare('SELECT * FROM tracks ORDER BY name').all();
    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getTrackById(req, res) {
  try {
    const db = getDb();
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(track);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function createTrack(req, res) {
  try {
    const db = getDb();
    const { name, country } = req.body;
    if (!name || !country) {
      return res.status(400).json({ error: 'name and country are required' });
    }
    const result = db.prepare('INSERT INTO tracks (name, country) VALUES (?, ?)').run(name, country);
    const id = result.lastInsertRowid;
    let track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
    if (!track) {
      track = { id, name, country, created_at: new Date().toISOString() };
    }
    res.status(201).json(track);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function updateTrack(req, res) {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid track id' });
    const existing = db.prepare('SELECT id FROM tracks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Track not found' });
    const { name, country } = req.body;
    if (!name || !country) {
      return res.status(400).json({ error: 'name and country are required' });
    }
    db.prepare('UPDATE tracks SET name = ?, country = ? WHERE id = ?').run(name, country, id);
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
    res.json(track);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function deleteTrack(req, res) {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Track not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAllTracks, getTrackById, createTrack, updateTrack, deleteTrack };
