// ============================================================
//  Battle Server — run with: node server.js
//  Requires: npm install ws
//  Players connect via ws://YOUR_IP:3000
// ============================================================

const { WebSocketServer } = require("ws");
const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });

// rooms[roomCode] = { players: [ws, ws], state: {} }
const rooms = {};

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, excludeWs = null) {
  room.players.forEach((p) => {
    if (p !== excludeWs) send(p, msg);
  });
}

wss.on("connection", (ws) => {
  ws.roomCode = null;
  ws.playerIndex = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── CREATE ROOM ──────────────────────────────────────────
    if (msg.type === "create_room") {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      rooms[code] = { players: [ws], pool: [null, null], draft: [null, null], ready: [false, false] };
      ws.roomCode = code;
      ws.playerIndex = 0;
      send(ws, { type: "room_created", code, playerIndex: 0 });
      return;
    }

    // ── JOIN ROOM ────────────────────────────────────────────
    if (msg.type === "join_room") {
      const room = rooms[msg.code];
      if (!room) { send(ws, { type: "error", message: "Room not found" }); return; }
      if (room.players.length >= 2) { send(ws, { type: "error", message: "Room full" }); return; }
      room.players.push(ws);
      ws.roomCode = msg.code;
      ws.playerIndex = 1;
      send(ws, { type: "room_joined", code: msg.code, playerIndex: 1 });
      broadcast(room, { type: "opponent_joined" }, ws);
      return;
    }

    // ── RELAY ALL OTHER MESSAGES ─────────────────────────────
    // pool_submitted, draft_submitted, battle_action, switch_request, etc.
    const room = ws.roomCode ? rooms[ws.roomCode] : null;
    if (!room) return;

    // Attach sender index so client knows who sent it
    msg.from = ws.playerIndex;
    broadcast(room, msg, ws);

    // Clean up finished rooms
    if (msg.type === "battle_over") {
      setTimeout(() => {
        if (rooms[ws.roomCode]) delete rooms[ws.roomCode];
      }, 5000);
    }
  });

  ws.on("close", () => {
    const room = ws.roomCode ? rooms[ws.roomCode] : null;
    if (room) {
      broadcast(room, { type: "opponent_disconnected" }, ws);
      delete rooms[ws.roomCode];
    }
  });
});

console.log(`\n🎮  Battle server running on ws://localhost:${PORT}`);
console.log(`    Share your local IP so friends can connect.\n`);
