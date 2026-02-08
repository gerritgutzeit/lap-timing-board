const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const tracksRouter = require('./routes/tracks');
const lapsRouter = require('./routes/laps');
const configRouter = require('./routes/config');
const exportImportRouter = require('./routes/exportImport');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/tracks', tracksRouter);
app.use('/api/laps', lapsRouter);
app.use('/api/config', configRouter);
app.use('/api/database', exportImportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`F1 Timing API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
