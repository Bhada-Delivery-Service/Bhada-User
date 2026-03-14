import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Home, Package, User, Bell, AlertCircle, Plus, ReceiptText } from 'lucide-react';
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
import DisputeChatPage from './pages/DisputeChatPage';
import RefundsPage from './pages/RefundsPage';
import FeedbackPage from './pages/FeedbackPage';

const TOAST_COLORS = {
  PAYMENT_REFUNDED: { bg:'var(--green-dim)',  border:'var(--green)',  icon:'💰' },
  ORDER_PLACED:     { bg:'var(--accent-dim)', border:'var(--accent)', icon:'📦' },
  ORDER_ACCEPTED:   { bg:'var(--accent-dim)', border:'var(--accent)', icon:'🛵' },
  ORDER_DISPATCHED: { bg:'var(--accent-dim)', border:'var(--accent)', icon:'🚀' },
  ORDER_DELIVERED:  { bg:'var(--green-dim)',  border:'var(--green)',  icon:'✅' },
  ORDER_CANCELLED:  { bg:'var(--red-dim)',    border:'var(--red)',    icon:'❌' },
  DISPUTE_RESOLVED: { bg:'var(--green-dim)',  border:'var(--green)',  icon:'✅' },
  default:          { bg:'var(--bg-elevated)',border:'var(--accent)', icon:'🔔' },
};

function ToastOverlay() {
  const { toasts, dismissToast } = useNotifications();
  if (!toasts?.length) return null;
  return (
    <div style={{
      position:'fixed', top:16, left:'50%', transform:'translateX(-50%)',
      zIndex:9999, display:'flex', flexDirection:'column', gap:8,
      width:'min(360px, calc(100vw - 24px))', pointerEvents:'none',
    }}>
      {toasts.map(t => {
        const cfg = TOAST_COLORS[t.type] || TOAST_COLORS.default;
        return (
          <div
            key={t.toastId}
            onClick={() => dismissToast(t.toastId)}
            style={{
              background:cfg.bg, border:`1px solid ${cfg.border}`,
              borderLeft:`3px solid ${cfg.border}`,
              borderRadius:'var(--radius)', padding:'12px 14px',
              display:'flex', alignItems:'flex-start', gap:10,
              boxShadow:'0 8px 28px rgba(0,0,0,0.25)',
              pointerEvents:'all', cursor:'pointer',
              animation:'slideDown 0.25s ease',
              position:'relative', overflow:'hidden',
            }}
          >
            <span style={{ fontSize:20, flexShrink:0, lineHeight:1.1 }}>{cfg.icon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:2 }}>{t.title}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.4 }}>{t.body}</div>
            </div>
            {/* Auto-dismiss progress bar */}
            <div style={{
              position:'absolute', bottom:0, left:0, right:0, height:2,
              background:`${cfg.border}40`,
            }}>
              <div style={{
                height:'100%', background:cfg.border, borderRadius:'0 0 var(--radius) var(--radius)',
                animation:'toastProgress 4s linear forwards',
              }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
      {unseenCount > 0 && <span className="nav-badge">{unseenCount > 9 ? '9+' : unseenCount}</span>}
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
    { path:'/',         icon:Home,        label:t('home')     },
    { path:'/orders',   icon:Package,     label:t('orders')   },
    { path:'/refunds',  icon:ReceiptText, label:'Refunds'     },
    { path:'/disputes', icon:AlertCircle, label:t('disputes') },
    { path:'/profile',  icon:User,        label:t('profile')  },
  ];

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const hideChrome =
    location.pathname.startsWith('/place-order') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/feedback') ||
    /^\/orders\/.+/.test(location.pathname) ||
    /^\/disputes\/(raise|.{10,})/.test(location.pathname) ||
    location.pathname.startsWith('/addresses');

  return (
    <div className="app-shell">
      {!hideChrome && (
        <nav className="top-nav">
          <div className="nav-brand">Bhada</div>
          <NotificationBell />
          <button className="nav-action nav-action-primary" onClick={() => navigate('/place-order')} title="New Order">
            <Plus size={18} />
          </button>
        </nav>
      )}

      <ToastOverlay />

      <div className={hideChrome ? '' : 'page-content'}>
        <Routes>
          <Route path="/"                   element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/orders"             element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/:id"         element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
          <Route path="/place-order"        element={<ProtectedRoute><PlaceOrderPage /></ProtectedRoute>} />
          <Route path="/profile"            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/addresses"          element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
          <Route path="/refunds"            element={<ProtectedRoute><RefundsPage /></ProtectedRoute>} />
          <Route path="/feedback"           element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
          <Route path="/disputes"           element={<ProtectedRoute><DisputesPage /></ProtectedRoute>} />
          <Route path="/disputes/raise"     element={<ProtectedRoute><RaiseDisputePage /></ProtectedRoute>} />
          <Route path="/disputes/:id/chat"  element={<ProtectedRoute><DisputeChatPage /></ProtectedRoute>} />
          <Route path="/disputes/:id"       element={<ProtectedRoute><DisputeDetailPage /></ProtectedRoute>} />
          <Route path="/login"              element={<LoginPage />} />
          <Route path="*"                   element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!hideChrome && (
        <nav className="bottom-tabs">
          {navItems.map(({ path, icon: Icon, label }) => (
            <div key={path} className={`tab-item ${isActive(path) ? 'active' : ''}`} onClick={() => navigate(path)}>
              <div className="tab-icon-wrap"><Icon size={19} /></div>
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