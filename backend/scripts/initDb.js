const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'f1timing.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

(async () => {
  const initSqlJs = require('sql.js').default || require('sql.js');
  const wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  const db = new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS laps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_name TEXT NOT NULL,
      lap_time TEXT NOT NULL,
      track_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_laps_track_id ON laps(track_id);
    CREATE INDEX IF NOT EXISTS idx_laps_lap_time ON laps(lap_time);

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_lap_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_name TEXT NOT NULL,
      lap_time_ms INTEGER NOT NULL,
      lap_time TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      suggested_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pending_lap_updates_track_name ON pending_lap_updates(track_name);
  `);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();
  console.log('Database initialized at', dbPath);
})();
