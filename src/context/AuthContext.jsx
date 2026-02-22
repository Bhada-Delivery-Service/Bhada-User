import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token      = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      // No token at all — go straight to login screen, no network call needed
      setLoading(false);
      return;
    }

    // KEY PATTERN (from rider app):
    // 1. Restore user from localStorage IMMEDIATELY so the app never flashes
    //    the login screen on refresh while the network call is in flight.
    // 2. Then validate the session in the background.
    // 3. Only logout if the server explicitly says the token is invalid (401
    //    or data.valid === false). Any other error (network down, 5xx) keeps
    //    the user logged in — the token might still be perfectly valid.
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    authAPI.checkSession()
      .then(({ data }) => {
        if (data.valid === false) {
          // Server explicitly says session is invalid → force logout
          logout();
        } else {
          // Session valid — optionally refresh user data from server response
          const freshUser = data.data || data.user;
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        }
      })
      .catch((err) => {
        // Only logout on 401 — token is genuinely rejected by the server.
        // Network errors, 5xx, timeouts: keep the user logged in.
        if (err?.response?.status === 401) {
          logout();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for token refresh events (from api.js interceptor)
  useEffect(() => {
    const handler = () => {
      authAPI.checkSession()
        .then(({ data }) => {
          const freshUser = data.data || data.user;
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        })
        .catch(() => {});
    };
    window.addEventListener('tokenRefreshed', handler);
    return () => window.removeEventListener('tokenRefreshed', handler);
  }, []);

  const loginWithFirebase = async (idToken) => {
    const { data } = await authAPI.verifyFirebase(idToken);
    const { accessToken, refreshToken, user: u } = data.data ?? data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(u));  // ← persist user
    setUser(u);
    return u;
  };

  const logout = () => {
    try { auth.signOut(); } catch (_) {}
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithFirebase, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};