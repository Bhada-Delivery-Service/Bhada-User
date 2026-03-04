import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../services/socketService';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user }                                  = useAuth();
  const [notifications, setNotifications]         = useState([]);
  const [unseenCount,   setUnseenCount]           = useState(0);
  const [loading,       setLoading]               = useState(false);
  const [drawerOpen,    setDrawerOpen]            = useState(false);
  const [toasts,        setToasts]               = useState([]);
  const pollRef   = useRef(null);
  const socketRef = useRef(null);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const pushToast = useCallback((notif) => {
    const toastId = `toast_${Date.now()}`;
    setToasts(prev => [...prev.slice(-2), { ...notif, toastId }]); // max 3
    setTimeout(() => setToasts(prev => prev.filter(t => t.toastId !== toastId)), 4500);
  }, []);

  // ── API fetch helpers ──────────────────────────────────────────────────────
  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await notificationsAPI.getCount();
      setUnseenCount(data.unseen ?? 0);
    } catch {}
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await notificationsAPI.getAll(50);
      const list = data.data || [];
      setNotifications(list);
      setUnseenCount(list.filter(n => !n.seen).length);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  // ── Poll unseen count every 30s ────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setNotifications([]); setUnseenCount(0); return; }
    fetchCount();
    pollRef.current = setInterval(fetchCount, 30_000);
    return () => clearInterval(pollRef.current);
  }, [user, fetchCount]);

  // ── Real-time socket ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.off('notification:new');
        socketRef.current.off('notification:count');
        socketRef.current.off('order:updated');
        socketRef.current.off('refund:updated');
        socketRef.current.off('dispute:updated');
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;

    // ── Incoming notification (persisted) ─────────────────────────────────
    socket.on('notification:new', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnseenCount(prev => prev + 1);
      pushToast(notif);
    });

    // ── Count update from server ──────────────────────────────────────────
    socket.on('notification:count', ({ unseen }) => {
      setUnseenCount(unseen ?? 0);
    });

    // ── Order status changed ──────────────────────────────────────────────
    socket.on('order:updated', (data) => {
      window.dispatchEvent(new CustomEvent('ws:order:updated', { detail: data }));
    });

    // ── Refund status changed ─────────────────────────────────────────────
    socket.on('refund:updated', (data) => {
      window.dispatchEvent(new CustomEvent('ws:refund:updated', { detail: data }));
      if (data.status === 'REFUNDED') {
        pushToast({
          type: 'PAYMENT_REFUNDED',
          title: 'Refund Processed ✓',
          body:  `₹${data.refundAmount} refund for order #${(data.orderId || '').slice(-8).toUpperCase()} has been credited.`,
        });
      }
    });

    // ── Dispute status changed ────────────────────────────────────────────
    socket.on('dispute:updated', (data) => {
      window.dispatchEvent(new CustomEvent('ws:dispute:updated', { detail: data }));
      const statusLabels = { RESOLVED: 'resolved ✓', REJECTED: 'rejected', CLOSED: 'closed' };
      if (statusLabels[data.status]) {
        pushToast({
          type: 'DISPUTE_RESOLVED',
          title: `Dispute ${statusLabels[data.status]}`,
          body: `Your dispute for order #${(data.orderId || '').slice(-8).toUpperCase()} has been ${statusLabels[data.status]}.`,
        });
      }
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:count');
      socket.off('order:updated');
      socket.off('refund:updated');
      socket.off('dispute:updated');
    };
  }, [user, pushToast]);

  // ── Drawer ─────────────────────────────────────────────────────────────────
  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const markSeen = useCallback(async (id) => {
    try {
      await notificationsAPI.markSeen(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, seen: true } : n));
      setUnseenCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const markAllSeen = useCallback(async () => {
    try {
      await notificationsAPI.markAllSeen();
      setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
      setUnseenCount(0);
    } catch {}
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unseenCount, loading, drawerOpen, toasts,
      openDrawer, closeDrawer, markSeen, markAllSeen, fetchNotifications, dismissToast,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}