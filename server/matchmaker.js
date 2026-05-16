// Matchmaker: routes incoming WS connections into rooms (quick queue or friend code).
// One open WebSocket per connected client. Each client is in at most one room.

import { makeRoom } from './gameRoom.js';
import { getBot } from './bots.js';

const ROOM_CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ23456789'; // no vowels/lookalikes
const FRIEND_CODE_LEN = 5;
const QUICK_TIMEOUT_MS = 30_000;

export function makeMatchmaker(wss) {
  const rooms = new Map();        // code -> room
  const quickQueue = [];          // ws[]
  let nextRoomId = 1;

  function newCode() {
    let attempts = 0;
    while (attempts++ < 25) {
      let code = '';
      for (let i = 0; i < FRIEND_CODE_LEN; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
      if (!rooms.has(code)) return code;
    }
    // Fallback (very unlikely)
    return 'X' + Date.now().toString(36).toUpperCase().slice(-4);
  }

  function placeIntoQuickQueue(ws) {
    quickQueue.push(ws);
    ws.queuedAt = Date.now();
    sendJSON(ws, { type: 'queued', position: quickQueue.length });
    tryPair();
    // Periodic ping to detect dead connections
  }

  function tryPair() {
    while (quickQueue.length >= 2) {
      const a = quickQueue.shift();
      const b = quickQueue.shift();
      if (a.readyState !== 1) { quickQueue.unshift(b); continue; }
      if (b.readyState !== 1) { quickQueue.unshift(a); continue; }
      startRoom(a, b, { code: null, kind: 'quick' });
    }
  }

  function startRoom(a, b, { code, kind }) {
    const id = `r${nextRoomId++}`;
    const room = makeRoom({
      id, code,
      onClose: () => {
        if (code) rooms.delete(code);
      },
    });
    if (code) rooms.set(code, room);
    room.addPlayer(a);
    room.addPlayer(b);
    sendJSON(a, { type: 'matched', roomId: id, kind });
    sendJSON(b, { type: 'matched', roomId: id, kind });
    room.startMatch();
  }

  function handleConnection(ws) {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    let joined = false;

    ws.on('message', (raw) => {
      let msg;
      try {
        if (raw.byteLength > 256) throw new Error('too_big');
        msg = JSON.parse(raw.toString());
      } catch {
        return; // ignore garbage
      }
      if (!msg || typeof msg.type !== 'string') return;

      // Forward in-room messages to the room
      if (ws.room && (msg.type === 'input' || msg.type === 'rematch' || msg.type === 'leave')) {
        ws.room.handleClientMessage(ws, msg);
        return;
      }

      if (joined) return;

      if (msg.type === 'join') {
        joined = true;
        const mode = msg.mode;
        const botId = getBot(msg.bot)?.id || 'wedge';
        const color = sanitizeColor(msg.color) || '#00eaff';
        ws.botId = botId;
        ws.color = color;
        ws.username = ws.user?.username || 'Player';

        if (mode === 'quick') {
          placeIntoQuickQueue(ws);
          // Time out and tell client if we can't pair
          setTimeout(() => {
            const idx = quickQueue.indexOf(ws);
            if (idx >= 0 && ws.readyState === 1) {
              quickQueue.splice(idx, 1);
              sendJSON(ws, { type: 'error', message: 'no opponents found, try again' });
              ws.close();
            }
          }, QUICK_TIMEOUT_MS);
        } else if (mode === 'create') {
          const code = newCode();
          const room = makeRoom({
            id: `r${nextRoomId++}`,
            code,
            onClose: () => rooms.delete(code),
          });
          rooms.set(code, room);
          room.addPlayer(ws);
          sendJSON(ws, { type: 'joined', code, slot: 0 });
        } else if (mode === 'friend') {
          const code = String(msg.code || '').toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            sendJSON(ws, { type: 'error', message: 'room not found' });
            ws.close();
            return;
          }
          if (!room.canJoin()) {
            sendJSON(ws, { type: 'error', message: 'room full' });
            ws.close();
            return;
          }
          room.addPlayer(ws);
          sendJSON(ws, { type: 'joined', code, slot: 1 });
          room.startMatch();
        } else {
          sendJSON(ws, { type: 'error', message: 'unknown mode' });
          ws.close();
        }
      }
    });

    ws.on('close', () => {
      const idx = quickQueue.indexOf(ws);
      if (idx >= 0) quickQueue.splice(idx, 1);
      if (ws.room) ws.room.handleDisconnect(ws);
    });

    ws.on('error', () => {});
  }

  // Heartbeat loop
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 15_000);

  function shutdown() {
    clearInterval(heartbeat);
    for (const r of rooms.values()) {
      try { r.shutdown(); } catch {}
    }
    rooms.clear();
    for (const ws of wss.clients) {
      try { sendJSON(ws, { type: 'error', message: 'server shutting down' }); ws.close(); } catch {}
    }
  }

  return { handleConnection, shutdown };
}

function sendJSON(ws, obj) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(obj)); } catch {}
}

function sanitizeColor(c) {
  if (!c) return null;
  const s = String(c).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  return null;
}
