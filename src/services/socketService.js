import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// ─── Socket change listeners ────────────────────────────────────────────────
// Any module (e.g. locationService) that holds a reference to the socket
// registers here. When NotificationContext replaces the socket (on token
// refresh), all listeners are called with the NEW socket so they can update
// their internal socketRef. Without this, locationService keeps emitting on
// a dead socket after every token refresh — which is exactly why the backend
// only ever received the very first location event.
const socketChangeListeners = new Set();

export function onSocketChanged(fn) {
  socketChangeListeners.add(fn);
  return () => socketChangeListeners.delete(fn); // returns unsubscribe fn
}

function notifySocketChanged(newSocket) {
  socketChangeListeners.forEach(fn => fn(newSocket));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function connectSocket(token) {
  // Already have a live connected socket — nothing to do.
  if (socket?.connected) return socket;

  // A socket exists but it is NOT connected (mid-reconnect or dead after token
  // refresh). Destroy it fully so we can create a fresh one with the new token.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[WS:Rider] Connected —', socket.id);
    socket.emit('ping');
  });

  socket.on('disconnect', (reason) => {
    console.warn('[WS:Rider] Disconnected —', reason);
    // Do NOT null out socket here. Socket.IO reconnects the same object
    // in-place. locationService.emitNow() guards on socketRef?.connected
    // so it skips silently while offline and resumes when reconnected.
  });

  socket.on('connect_error', (err) => {
    console.warn('[WS:Rider] Connection error —', err.message);
  });

  // KEY FIX: tell locationService about the new socket object so it
  // updates its internal socketRef. Without this call, locationService
  // holds a stale reference to the previous (dead) socket forever.
  notifySocketChanged(socket);

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  notifySocketChanged(null);
}

export function getSocket() {
  return socket;
}