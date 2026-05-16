// Client WebSocket connection to the realtime backend.
// Returns a "handle" with onState / onMatchStart / onMatchEnd callbacks the game wires up.

import { getApiUrl, getToken } from './storage.js';

export function isOnline() { return !!getApiUrl(); }

// connect({mode:'quick'|'create'|'friend', code?, botId, color}) → Promise<handle>
export async function connect({ mode, code, botId, color }) {
  const api = getApiUrl();
  if (!api) throw new Error('no_backend');
  const token = getToken();
  if (!token) throw new Error('no_token');

  // ws[s]://host/play?token=…
  const wsUrl = api.replace(/^http/, 'ws') + '/play?token=' + encodeURIComponent(token);
  const ws = new WebSocket(wsUrl);

  return await new Promise((resolve, reject) => {
    let resolved = false;
    const handle = {
      ws,
      token,
      mode,
      onJoined: null,
      onMatchStart: null,
      onState: null,
      onRoundEnd: null,
      onMatchEnd: null,
      onError: null,
      onClose: null,
      sendInput(input) {
        if (ws.readyState !== 1) return;
        try {
          ws.send(JSON.stringify({
            type: 'input',
            t: performance.now() | 0,
            ax: input.ax,
            attack: !!input.attack,
            special: !!input.special,
          }));
        } catch {}
      },
      requestRematch() {
        if (ws.readyState !== 1) return;
        try { ws.send(JSON.stringify({ type: 'rematch' })); } catch {}
      },
      disconnect() {
        try { ws.close(); } catch {}
      },
    };

    ws.addEventListener('open', () => {
      const join = { type: 'join', mode, bot: botId, color };
      if (code) join.code = code;
      ws.send(JSON.stringify(join));
      if (!resolved) { resolved = true; resolve(handle); }
    });
    ws.addEventListener('error', (e) => {
      if (!resolved) { resolved = true; reject(new Error('ws_error')); }
      if (handle.onError) handle.onError(e);
    });
    ws.addEventListener('close', () => {
      if (handle.onClose) handle.onClose();
    });
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case 'queued':
          // Optionally surface position
          break;
        case 'joined':
          if (handle.onJoined) handle.onJoined(msg);
          break;
        case 'matched':
          // Server has paired you; 'start' will follow when room is ready
          break;
        case 'roomUpdate':
          // Other player joined the room
          break;
        case 'start':
        case 'rematchStart':
          if (handle.onMatchStart) handle.onMatchStart(msg);
          break;
        case 'roundStart':
          // (we let the server's first 'state' message kick the round off)
          break;
        case 'state':
          if (handle.onState) handle.onState(msg);
          break;
        case 'roundEnd':
          if (handle.onRoundEnd) handle.onRoundEnd(msg);
          break;
        case 'matchEnd':
          if (handle.onMatchEnd) handle.onMatchEnd(msg);
          break;
        case 'playerDc':
          // Surface as toast in caller if desired
          break;
        case 'error':
          if (handle.onError) handle.onError(new Error(msg.message || 'server_error'));
          if (!resolved) { resolved = true; reject(new Error(msg.message || 'server_error')); }
          try { ws.close(); } catch {}
          break;
      }
    });

    // Connect timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { ws.close(); } catch {}
        reject(new Error('connect_timeout'));
      }
    }, 8000);
  });
}

export function disconnect(handle) {
  try { handle?.ws?.close(); } catch {}
}
