/**
 * locationService.js
 *
 * Tracks the rider's GPS and streams it to the backend via Socket.IO.
 *
 * ROOT BUG FIX — why the backend only received location once:
 *
 *   NotificationContext calls disconnectSocket() + connectSocket() whenever
 *   accessToken changes (token refresh). This destroys the old socket object
 *   and creates a brand-new one. But locationService stored the OLD socket in
 *   socketRef and never knew about the replacement. So every emit() after the
 *   first token refresh was firing into a dead socket that the server had
 *   already closed — silently dropped, no error thrown.
 *
 *   Fix: subscribe to onSocketChanged() from socketService. Whenever a new
 *   socket is created (or destroyed), locationService updates socketRef
 *   automatically. The existing interval keeps running — it will naturally
 *   skip emits while socket.connected === false and resume the moment the
 *   new socket connects.
 */

import { onSocketChanged } from './socketService';

const EMIT_INTERVAL_MS  = 5000;
const WARMUP_TIMEOUT_MS = 8000;

const GEO_OPTIONS_FAST = {
  enableHighAccuracy: false,
  maximumAge        : 30_000,
  timeout           : 5_000,
};

const GEO_OPTIONS_ACCURATE = {
  enableHighAccuracy: true,
  maximumAge        : 3_000,
  timeout           : 10_000,
};

let watchId      = null;
let intervalId   = null;
let lastPosition = null;
let socketRef    = null;
let warmedUp     = false;
let onConnectHandler   = null;
let unsubSocketChange  = null; // unsubscribe handle for onSocketChanged

/* ─── Internal helpers ────────────────────────────────────────────────────── */

function buildPayload(pos) {
  const { latitude, longitude, accuracy, heading, speed } = pos.coords;
  return {
    latitude,
    longitude,
    accuracy : accuracy  || 0,
    heading  : heading   || null,
    speed    : speed     || null,
    timestamp: Date.now(),
  };
}

function emitNow() {
  if (!lastPosition || !socketRef?.connected) return;
  socketRef.emit('rider:location', buildPayload(lastPosition));
}

function emitOnConnect(onFirstFix) {
  if (onConnectHandler) {
    socketRef?.off('connect', onConnectHandler);
    onConnectHandler = null;
  }

  if (socketRef?.connected) {
    emitNow();
    onFirstFix?.();
    console.log('[Location] First fix emitted immediately (socket was already connected)');
    return;
  }

  onConnectHandler = () => {
    emitNow();
    onFirstFix?.();
    onConnectHandler = null;
    console.log('[Location] First fix emitted on socket connect');
  };
  socketRef?.once('connect', onConnectHandler);
}

/* ─── Socket change handler ───────────────────────────────────────────────── */

/**
 * Called by socketService whenever the socket object is replaced (new token)
 * or destroyed (logout). This keeps socketRef always pointing at the live
 * socket so emitNow() never fires into a dead connection.
 */
function handleSocketChanged(newSocket) {
  // Clean up any pending connect listener on the OLD socket
  if (onConnectHandler && socketRef) {
    socketRef.off('connect', onConnectHandler);
    onConnectHandler = null;
  }

  socketRef = newSocket; // null on logout, new socket object on token refresh

  // If tracking is active and we just got a new live socket, attach a
  // one-shot connect listener so we emit as soon as it finishes handshaking.
  // This means the backend gets a GPS ping immediately on reconnect instead
  // of waiting for the next interval tick (up to EMIT_INTERVAL_MS away).
  if (intervalId !== null && newSocket) {
    console.log('[Location] Socket replaced — will emit on next connect');
    emitOnConnect(null);
  }
}

/* ─── Public API ──────────────────────────────────────────────────────────── */

export function warmupGPS() {
  if (warmedUp || !navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lastPosition = pos;
      warmedUp = true;
      console.log('[Location] GPS warmed up —', pos.coords.latitude.toFixed(5), pos.coords.longitude.toFixed(5));
    },
    (err) => {
      console.warn('[Location] Warmup failed:', err.message);
      warmedUp = true;
    },
    GEO_OPTIONS_FAST,
  );
}

export function startTracking(socket, onFirstFix) {
  if (!socket) {
    console.warn('[Location] No socket provided to startTracking');
    return;
  }
  if (!navigator.geolocation) {
    console.warn('[Location] Geolocation not supported');
    return;
  }

  socketRef = socket;

  // Subscribe to socket replacements so socketRef stays fresh forever.
  // Unsubscribe first if already subscribed (e.g. startTracking called twice).
  if (unsubSocketChange) unsubSocketChange();
  unsubSocketChange = onSocketChanged(handleSocketChanged);

  // ── Step 1: emit first fix ───────────────────────────────────────────────
  if (lastPosition) {
    if (socket.connected) {
      emitNow();
      onFirstFix?.();
      console.log('[Location] First fix emitted instantly (socket connected + GPS cached)');
    } else {
      console.log('[Location] GPS cached but socket not yet connected — waiting for connect event');
      emitOnConnect(onFirstFix);
    }
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastPosition = pos;
        emitOnConnect(onFirstFix);
        console.log('[Location] Fresh GPS acquired — emitting via emitOnConnect');
      },
      (err) => {
        console.warn('[Location] First-fix failed:', err.message);
      },
      { ...GEO_OPTIONS_FAST, timeout: WARMUP_TIMEOUT_MS },
    );
  }

  // ── Step 2: keep watching for high-accuracy updates ─────────────────────
  if (watchId === null) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => { lastPosition = pos; },
      (err) => console.warn('[Location] watchPosition error:', err.message),
      GEO_OPTIONS_ACCURATE,
    );
  }

  // ── Step 3: broadcast on fixed interval ─────────────────────────────────
  if (intervalId === null) {
    intervalId = setInterval(emitNow, EMIT_INTERVAL_MS);
  }

  console.log('[Location] Tracking started');
}

export function stopTracking() {
  if (onConnectHandler && socketRef) {
    socketRef.off('connect', onConnectHandler);
    onConnectHandler = null;
  }

  // Unsubscribe from socket change events
  if (unsubSocketChange) {
    unsubSocketChange();
    unsubSocketChange = null;
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }

  socketRef = null;
  console.log('[Location] Tracking stopped');
}

export function getCurrentPosition() {
  if (lastPosition) {
    const ageMs = Date.now() - lastPosition.timestamp;
    if (ageMs < 30_000) {
      return Promise.resolve({
        lat: lastPosition.coords.latitude,
        lng: lastPosition.coords.longitude,
      });
    }
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastPosition = pos;
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      reject,
      GEO_OPTIONS_ACCURATE,
    );
  });
}