/**
 * UDP telemetry service: binds to configurable IP:port, receives F1 25 UDP packets,
 * parses Lap Data (packetId 2), and exposes latest lap state for the API.
 */

const dgram = require('dgram');
const { parsePacketByType, isLapDataPacket, isSessionPacket, isParticipantsPacket } = require('./f1-25-parser');

let socket = null;
let state = {
  currentLapTimeMs: null,
  lastLapTimeMs: null,
  receivedAt: null,
  error: null,
  trackName: null,
  driverName: null,
};

const STALE_MS = 2500; // Consider data "hot" for this long after last packet

// Debug: count packets (any UDP + Lap Data), log periodically
let debugAnyCount = 0;
let debugLapDataCount = 0;
let debugLastLog = 0;
const DEBUG_LOG_INTERVAL_MS = 5000;

function getState() {
  const isHot = !!(state.receivedAt && Date.now() - state.receivedAt < STALE_MS);
  return {
    currentLapTimeMs: state.currentLapTimeMs,
    lastLapTimeMs: state.lastLapTimeMs,
    receivedAt: state.receivedAt,
    error: state.error,
    isHot,
    trackName: state.trackName,
    driverName: state.driverName,
  };
}

function onMessage(msg) {
  state.error = null;
  debugAnyCount += 1;
  if (!Buffer.isBuffer(msg)) return;
  const now = Date.now();
  const packetId = msg.length >= 7 ? msg[6] : null;

  if (isSessionPacket(msg)) {
    const parsed = parsePacketByType(msg);
    if (parsed && parsed.trackName != null) {
      state.trackName = parsed.trackName;
    }
    return;
  }
  if (isParticipantsPacket(msg)) {
    const parsed = parsePacketByType(msg);
    if (parsed && parsed.driverName != null) {
      state.driverName = parsed.driverName;
    }
    return;
  }

  if (!isLapDataPacket(msg)) {
    if (debugAnyCount === 1) {
      console.log(`[F1 25 UDP] First packet received: ${msg.length} bytes (packetId=${packetId}). Expect Lap Data packetId=2, size=1285. In game set UDP to this PC IP and port.`);
    } else if (now - debugLastLog >= DEBUG_LOG_INTERVAL_MS) {
      console.log(`[F1 25 UDP] UDP traffic: ${debugAnyCount} total packets, ${debugLapDataCount} Lap Data. Last packet ${msg.length}B, packetId=${packetId}.`);
      debugLastLog = now;
    }
    return;
  }
  debugLapDataCount += 1;
  const parsed = parsePacketByType(msg);
  if (!parsed) return;
  state.currentLapTimeMs = parsed.currentLapTimeMs;
  state.lastLapTimeMs = parsed.lastLapTimeMs;
  state.receivedAt = Date.now();
  if (debugLapDataCount <= 3 || debugLapDataCount % 100 === 0) {
    console.log(`[F1 25 UDP] Lap Data: current=${parsed.currentLapTimeMs}ms last=${parsed.lastLapTimeMs}ms`);
  }
}

function createSocket(bindAddress, port) {
  return new Promise((resolve, reject) => {
    const s = dgram.createSocket('udp4');
    s.on('error', (err) => {
      state.error = err.message;
      reject(err);
    });
    s.on('message', onMessage);
    s.bind({ address: bindAddress, port }, () => {
      state.error = null;
      resolve(s);
    });
  });
}

async function start(getConfig) {
  stop();
  let bindAddress = '0.0.0.0';
  let port = 20777;
  if (typeof getConfig === 'function') {
    try {
      const c = getConfig();
      if (c && c.bindAddress) bindAddress = c.bindAddress;
      if (c && typeof c.port === 'number') port = c.port;
    } catch (_) {}
  }
  try {
    socket = await createSocket(bindAddress, port);
    console.log(`[F1 25 UDP] Listening on ${bindAddress}:${port}`);
  } catch (err) {
    console.error('[F1 25 UDP] Failed to start:', err.message);
  }
}

function stop() {
  if (socket) {
    try {
      socket.close();
    } catch (_) {}
    socket = null;
  }
}

module.exports = {
  getState,
  start,
  stop,
  STALE_MS,
};
