import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Home, Package, User, Bell, AlertCircle, Plus } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ThemeProvider } from './context/Themecontext';
import { LangProvider, useLang } from './context/Langcontext';
import NotificationDrawer from './components/NotificationDrawer';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import { OrdersPage, OrderDetailPage } from './pages/OrdersPage';
import PlaceOrderPage from './pages/PlaceOrderPage';
import ProfilePage from './pages/ProfilePage';
import AddressesPage from './pages/AddressesPage';
import DisputesPage, { RaiseDisputePage, DisputeDetailPage } from './pages/DisputesPage';

function Loading() {
  return (
    <div style={{ display:'grid', placeItems:'center', height:'100vh', background:'var(--bg-base)' }}>
      <div className="spinner spinner-lg" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ProtectedWrapper({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function NotificationBell() {
  const { unseenCount, openDrawer } = useNotifications();
  return (
    <button className="nav-action" onClick={openDrawer}>
      <Bell size={17} />
      {unseenCount > 0 && (
        <span className="nav-badge">{unseenCount > 9 ? '9+' : unseenCount}</span>
      )}
    </button>
  );
}

function AppShell() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const navItems = [
    { path: '/',         icon: Home,         label: t('home')     },
    { path: '/orders',   icon: Package,      label: t('orders')   },
    { path: '/disputes', icon: AlertCircle,  label: t('disputes') },
    { path: '/profile',  icon: User,         label: t('profile')  },
  ];

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const hideChrome =
    location.pathname.startsWith('/place-order') ||
    location.pathname.startsWith('/login') ||
    /^\/orders\/.+/.test(location.pathname) ||
    /^\/disputes\/(raise|.{10,})/.test(location.pathname) ||
    location.pathname.startsWith('/addresses');

  return (
    <div className="app-shell">
      {!hideChrome && (
        <nav className="top-nav">
          <div className="nav-brand">Bhada</div>
          <NotificationBell />
          <button
            className="nav-action nav-action-primary"
            onClick={() => navigate('/place-order')}
            title="New Order"
          >
            <Plus size={18} />
          </button>
        </nav>
      )}

      <div className={hideChrome ? '' : 'page-content'}>
        <Routes>
          <Route path="/"                   element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/orders"             element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/:id"         element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
          <Route path="/place-order"        element={<ProtectedRoute><PlaceOrderPage /></ProtectedRoute>} />
          <Route path="/profile"            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/addresses"          element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
          <Route path="/disputes"           element={<ProtectedRoute><DisputesPage /></ProtectedRoute>} />
          <Route path="/disputes/raise"     element={<ProtectedRoute><RaiseDisputePage /></ProtectedRoute>} />
          <Route path="/disputes/:id"       element={<ProtectedRoute><DisputeDetailPage /></ProtectedRoute>} />
          <Route path="/login"              element={<LoginPage />} />
          <Route path="*"                   element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!hideChrome && (
        <nav className="bottom-tabs">
          {navItems.map(({ path, icon: Icon, label }) => (
            <div
              key={path}
              className={`tab-item ${isActive(path) ? 'active' : ''}`}
              onClick={() => navigate(path)}
            >
              <div className="tab-icon-wrap">
                <Icon size={19} />
              </div>
              {label}
            </div>
          ))}
        </nav>
      )}

      <NotificationDrawer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <NotificationProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={
                  <ProtectedWrapper>
                    <AppShell />
                  </ProtectedWrapper>
                } />
              </Routes>
            </NotificationProvider>
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}