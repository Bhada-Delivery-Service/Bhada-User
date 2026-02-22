import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unseenCount,   setUnseenCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const pollRef = useRef(null);

  // Lightweight poll — just count, not full list
  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await notificationsAPI.getCount();
      setUnseenCount(data.unseen ?? 0);
    } catch {}
  }, [user]);

  // Full list — only fetched when drawer opens or user refreshes
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

  // Poll unseen count every 30s
  useEffect(() => {
    if (!user) { setNotifications([]); setUnseenCount(0); return; }
    fetchCount();
    pollRef.current = setInterval(fetchCount, 30_000);
    return () => clearInterval(pollRef.current);
  }, [user, fetchCount]);

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

  return (
    <NotificationContext.Provider value={{
      notifications, unseenCount, loading, drawerOpen,
      openDrawer, closeDrawer, markSeen, markAllSeen, fetchNotifications,
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
