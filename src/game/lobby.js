import { showScreen, toast } from './main.js';
import {
  renderPoolGrid, confirmPool, checkBothPools,
  renderOppPoolDisplay, checkBothDrafts,
  oppPool, oppTeam, resetDraftState,
} from './pool.js';
import { processOpponentAction } from './battle-ui.js';

// ── WS state ──────────────────────────────────────────────────────────────────
export let ws        = null;
export let isSolo    = false;
export let myIndex   = 0;
export let roomCode  = '';

let _currentScreen = 'title';
export function setCurrentScreen(s) { _currentScreen = s; }

// ── Solo ──────────────────────────────────────────────────────────────────────
export function startSolo() {
  isSolo = true; ws = null;
  showScreen('pool');
  renderPoolGrid();
}

// ── Multiplayer ───────────────────────────────────────────────────────────────
export function showJoinInput() {
  document.getElementById('join-input-wrap').style.display = 'block';
}

export function createRoom() {
  const ip = document.getElementById('server-ip').value.trim() || 'localhost';
  connectWS(ip, () => ws.send(JSON.stringify({ type: 'create_room' })));
}

export function joinRoom() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) { toast('Enter a room code'); return; }
  const ip = document.getElementById('server-ip').value.trim() || 'localhost';
  connectWS(ip, () => ws.send(JSON.stringify({ type: 'join_room', code })));
}

function connectWS(ip, onOpen) {
  setLobbyStatus('Connecting...');
  try { ws = new WebSocket(`ws://${ip}:3000`); } catch (e) { setLobbyStatus('Connection failed.'); return; }
  ws.onopen  = onOpen;
  ws.onerror = () => setLobbyStatus('Could not connect. Is the server running?');
  ws.onclose = () => { if (_currentScreen !== 'result') setLobbyStatus('Disconnected.'); };
  ws.onmessage = e => handleWS(JSON.parse(e.data));
}

function handleWS(msg) {
  switch (msg.type) {
    case 'room_created':
      roomCode = msg.code; myIndex = 0;
      document.getElementById('room-code-wrap').style.display = 'block';
      document.getElementById('room-code-display').textContent = msg.code;
      setLobbyStatus('Waiting for opponent…');
      break;
    case 'room_joined':
      myIndex = msg.index;
      setLobbyStatus('Joined!');
      setTimeout(() => { showScreen('pool'); renderPoolGrid(); }, 400);
      break;
    case 'game_start':
      setTimeout(() => { showScreen('pool'); renderPoolGrid(); }, 400);
      break;
    case 'pool_submitted':
      // oppPool is a let export in pool.js — re-assign via setter
      import('./pool.js').then(m => { m.oppPool.splice(0, m.oppPool.length, ...msg.pool); m.renderOppPoolDisplay(); checkBothPools(); });
      break;
    case 'draft_submitted':
      import('./pool.js').then(m => { m.oppTeam.splice(0, m.oppTeam.length, ...msg.team); checkBothDrafts(isSolo, ws); });
      break;
    case 'battle_action':
      processOpponentAction(msg);
      break;
    case 'battle_over':
      break;
    case 'opponent_disconnected':
      toast('Opponent disconnected!');
      break;
    case 'error':
      toast(msg.message);
      break;
  }
}

function setLobbyStatus(t) {
  document.getElementById('lobby-status').textContent = t;
}
