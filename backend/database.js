const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'f1timing.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let SQL = null;
let db = null;

function createDbWrapper(nativeDb) {
  function save() {
    try {
      const data = nativeDb.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (err) {
      console.error('Failed to save database:', err.message);
    }
  }

  return {
    prepare(sql) {
      return {
        run(...params) {
          const bound = params.length ? params : undefined;
          nativeDb.run(sql, bound);
          const changes = nativeDb.getRowsModified();
          const lastIdStmt = nativeDb.prepare('SELECT last_insert_rowid() as id');
          let lastId = 0;
          if (lastIdStmt.step()) {
            const row = lastIdStmt.getAsObject();
            lastId = Number(row?.id) || 0;
          }
          lastIdStmt.free();
          save();
          return {
            lastInsertRowid: lastId,
            changes,
          };
        },
        get(...params) {
          const stmt = nativeDb.prepare(sql, params.length ? params : undefined);
          try {
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally {
            stmt.free();
          }
        },
        all(...params) {
          const stmt = nativeDb.prepare(sql, params.length ? params : undefined);
          const rows = [];
          try {
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.free();
          }
        },
      };
    },
  };
}

async function initDatabase() {
  if (db) return;
  const initSqlJs = require('sql.js').default || require('sql.js');
  const wasmPath = path.join(
    __dirname,
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  );
  SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  let nativeDb;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    nativeDb = new SQL.Database(buffer);
  } else {
    nativeDb = new SQL.Database();
  }

  nativeDb.run(`
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
  `);
  nativeDb.run('CREATE INDEX IF NOT EXISTS idx_laps_track_id ON laps(track_id)');
  nativeDb.run('CREATE INDEX IF NOT EXISTS idx_laps_lap_time ON laps(lap_time)');

  nativeDb.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db = createDbWrapper(nativeDb);
  try {
    fs.writeFileSync(dbPath, Buffer.from(nativeDb.export()));
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

function getDb() {
  if (!db)
    throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

module.exports = { initDatabase, getDb };