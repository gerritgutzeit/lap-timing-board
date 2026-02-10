/**
 * Modular F1 25 UDP packet parser.
 * Based on: https://github.com/MacManley/f1-25-udp
 * All values are Little Endian. Only packet types we need are implemented;
 * add new handlers in parsePacketByType for additional packet types.
 */

const PACKET_ID = {
  MOTION: 0,
  SESSION: 1,
  LAP_DATA: 2,
  EVENT: 3,
  PARTICIPANTS: 4,
  CAR_SETUPS: 5,
  CAR_TELEMETRY: 6,
  CAR_STATUS: 7,
  FINAL_CLASSIFICATION: 8,
  LOBBY_INFO: 9,
  CAR_DAMAGE: 10,
  SESSION_HISTORY: 11,
  TYRE_SETS: 12,
  MOTION_EX: 13,
  TIME_TRIAL: 14,
  LAP_POSITIONS: 15,
};

const PACKET_HEADER_SIZE = 29;
const LAP_DATA_PACKET_SIZE = 1285;
const LAP_DATA_ENTRY_SIZE = 57; // (1285 - 29 - 2) / 22
const SESSION_PACKET_SIZE = 753;
const PARTICIPANTS_PACKET_SIZE = 1284;
const PARTICIPANT_ENTRY_SIZE = 57; // (1284 - 29 - 1) / 22
const PARTICIPANT_NAME_OFFSET = 7; // after aiControlled, driverId, networkId, teamId, myTeam, raceNumber, nationality
const PARTICIPANT_NAME_SIZE = 32;
// Session packet: header(29) + weather(1) + trackTemp(1) + airTemp(1) + totalLaps(1) + trackLength(2) + sessionType(1) = 36, then m_trackId
const SESSION_TRACK_ID_OFFSET = 36;

/** F1 25 track ID to name (matches common appendix; -1 = unknown) */
const TRACK_IDS = {
  [-1]: 'Unknown',
  0: 'Melbourne',
  1: 'Paul Ricard',
  2: 'Shanghai',
  3: 'Sakhir',
  4: 'Catalunya',
  5: 'Monaco',
  6: 'Montreal',
  7: 'Silverstone',
  8: 'Hockenheim',
  9: 'Hungaroring',
  10: 'Spa',
  11: 'Monza',
  12: 'Singapore',
  13: 'Suzuka',
  14: 'Abu Dhabi',
  15: 'Texas',
  16: 'Bahrain',
  17: 'Red Bull Ring',
  18: 'Portugal',
  19: 'Italy',
  20: 'Jeddah',
  21: 'Miami',
  22: 'Las Vegas',
  23: 'Losail',
  24: 'Imola',
  25: 'Zandvoort',
  26: 'Baku',
};

// Header layout: packetFormat(2) + gameYear(1) + gameMajor(1) + gameMinor(1) + packetVersion(1) + packetId(1) + sessionUID(8) + sessionTime(4) + frameId(4) + overallFrameId(4) + playerCarIndex(1) + secondaryPlayerCarIndex(1) = 29
const HEADER_OFFSET_PACKET_ID = 6;
const HEADER_OFFSET_PLAYER_CAR_INDEX = 27;

/**
 * Parse F1 25 packet header (29 bytes).
 * @param {Buffer} buf - Buffer starting at packet start
 * @returns {{ packetId: number, playerCarIndex: number } | null}
 */
function parseHeader(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < PACKET_HEADER_SIZE) return null;
  try {
    const packetId = buf.readUInt8(HEADER_OFFSET_PACKET_ID);
    const playerCarIndex = buf.readUInt8(HEADER_OFFSET_PLAYER_CAR_INDEX);
    return { packetId, playerCarIndex };
  } catch (_) {
    return null;
  }
}

/**
 * Minimum bytes needed to read player's lap times: header + player's LapData (first 8 bytes).
 */
function minLapDataLengthForPlayer(playerCarIndex) {
  return PACKET_HEADER_SIZE + playerCarIndex * LAP_DATA_ENTRY_SIZE + 8;
}

/**
 * Parse Lap Data packet (packetId = 2).
 * Extracts last and current lap time in ms for the player car.
 * Accepts full 1285-byte packet or any buffer long enough for the player's LapData entry.
 * @param {Buffer} buf - Packet buffer (full 1285 bytes or at least header + player LapData)
 * @param {number} playerCarIndex - From header
 * @returns {{ currentLapTimeMs: number, lastLapTimeMs: number } | null}
 */
function parseLapDataPacket(buf, playerCarIndex) {
  if (!Buffer.isBuffer(buf) || playerCarIndex < 0 || playerCarIndex > 21) return null;
  const minLen = minLapDataLengthForPlayer(playerCarIndex);
  if (buf.length < minLen) return null;
  try {
    const base = PACKET_HEADER_SIZE + playerCarIndex * LAP_DATA_ENTRY_SIZE;
    const lastLapTimeMs = buf.readUInt32LE(base);
    const currentLapTimeMs = buf.readUInt32LE(base + 4);
    return { currentLapTimeMs, lastLapTimeMs };
  } catch (_) {
    return null;
  }
}

/**
 * Parse Session packet (packetId = 1). Extracts track ID and returns track name.
 * @param {Buffer} buf - Full packet (at least 37 bytes for trackId)
 * @returns {{ trackId: number, trackName: string } | null}
 */
function parseSessionPacket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < SESSION_TRACK_ID_OFFSET + 1) return null;
  try {
    const trackId = buf.readInt8(SESSION_TRACK_ID_OFFSET);
    const trackName = TRACK_IDS[trackId] != null ? TRACK_IDS[trackId] : (trackId === -1 ? 'Unknown' : `Track ${trackId}`);
    return { trackId, trackName };
  } catch (_) {
    return null;
  }
}

/**
 * Parse Participants packet (packetId = 4). Extracts driver name for player car.
 * @param {Buffer} buf - Full packet
 * @param {number} playerCarIndex - From header
 * @returns {{ driverName: string } | null}
 */
function parseParticipantsPacket(buf, playerCarIndex) {
  if (!Buffer.isBuffer(buf) || buf.length < PARTICIPANTS_PACKET_SIZE) return null;
  if (playerCarIndex < 0 || playerCarIndex > 21) return null;
  try {
    const base = PACKET_HEADER_SIZE + 1 + playerCarIndex * PARTICIPANT_ENTRY_SIZE + PARTICIPANT_NAME_OFFSET;
    const nameBuf = buf.slice(base, base + PARTICIPANT_NAME_SIZE);
    const driverName = nameBuf.toString('utf8').replace(/\0/g, '').trim() || null;
    return { driverName };
  } catch (_) {
    return null;
  }
}

/**
 * Route buffer to the correct packet handler by packetId.
 * Add new packet types here to keep the parser modular.
 * @param {Buffer} buf - Raw UDP payload
 * @returns {object | null} Parsed result or null if unknown/invalid
 */
function parsePacketByType(buf) {
  const header = parseHeader(buf);
  if (!header) return null;

  switch (header.packetId) {
    case PACKET_ID.LAP_DATA:
      return parseLapDataPacket(buf, header.playerCarIndex);
    case PACKET_ID.SESSION:
      return parseSessionPacket(buf);
    case PACKET_ID.PARTICIPANTS:
      return parseParticipantsPacket(buf, header.playerCarIndex);
    default:
      return null;
  }
}

/**
 * Check if buffer looks like a valid F1 25 Lap Data packet (packetId 2, correct size).
 * Allows quick rejection of wrong/incomplete packets.
 */
function isLapDataPacket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < PACKET_HEADER_SIZE) return false;
  try {
    if (buf.readUInt8(HEADER_OFFSET_PACKET_ID) !== PACKET_ID.LAP_DATA) return false;
    const playerCarIndex = buf.readUInt8(HEADER_OFFSET_PLAYER_CAR_INDEX);
    return playerCarIndex <= 21 && buf.length >= minLapDataLengthForPlayer(playerCarIndex);
  } catch (_) {
    return false;
  }
}

function isSessionPacket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < SESSION_TRACK_ID_OFFSET + 1) return false;
  return buf.readUInt8(HEADER_OFFSET_PACKET_ID) === PACKET_ID.SESSION;
}

function isParticipantsPacket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < PARTICIPANTS_PACKET_SIZE) return false;
  return buf.readUInt8(HEADER_OFFSET_PACKET_ID) === PACKET_ID.PARTICIPANTS;
}

module.exports = {
  PACKET_ID,
  PACKET_HEADER_SIZE,
  LAP_DATA_PACKET_SIZE,
  parseHeader,
  parseLapDataPacket,
  parseSessionPacket,
  parseParticipantsPacket,
  parsePacketByType,
  isLapDataPacket,
  isSessionPacket,
  isParticipantsPacket,
};
