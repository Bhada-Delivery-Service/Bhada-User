import React from 'react';
import { X, Bell, CheckCheck, RefreshCw, Package, Bike, AlertTriangle, CreditCard, FileText } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

const TYPE_META = {
  ONBOARDING_SUBMITTED: { Icon: FileText,      color: 'var(--blue)',    bg: 'var(--blue-dim)',    tag: 'Onboarding' },
  ONBOARDING_APPROVED:  { Icon: Bell,          color: 'var(--green)',   bg: 'var(--green-dim)',   tag: 'Onboarding' },
  ONBOARDING_REJECTED:  { Icon: Bell,          color: 'var(--red)',     bg: 'var(--red-dim)',     tag: 'Onboarding' },
  KYC_SUBMITTED:        { Icon: FileText,      color: 'var(--blue)',    bg: 'var(--blue-dim)',    tag: 'KYC' },
  KYC_APPROVED:         { Icon: FileText,      color: 'var(--green)',   bg: 'var(--green-dim)',   tag: 'KYC' },
  KYC_REJECTED:         { Icon: FileText,      color: 'var(--red)',     bg: 'var(--red-dim)',     tag: 'KYC' },
  ORDER_PLACED:         { Icon: Package,       color: 'var(--accent)',  bg: 'var(--accent-dim)',  tag: 'Order' },
  ORDER_ACCEPTED:       { Icon: Bike,          color: 'var(--accent)',  bg: 'var(--accent-dim)',  tag: 'Order' },
  ORDER_DISPATCHED:     { Icon: Bike,          color: 'var(--accent)',  bg: 'var(--accent-dim)',  tag: 'Order' },
  ORDER_DELIVERED:      { Icon: Package,       color: 'var(--green)',   bg: 'var(--green-dim)',   tag: 'Order' },
  ORDER_CANCELLED:      { Icon: Package,       color: 'var(--red)',     bg: 'var(--red-dim)',     tag: 'Order' },
  DISPUTE_RAISED:       { Icon: AlertTriangle, color: 'var(--orange)',  bg: 'var(--orange-dim)',  tag: 'Dispute' },
  DISPUTE_RESOLVED:     { Icon: AlertTriangle, color: 'var(--green)',   bg: 'var(--green-dim)',   tag: 'Dispute' },
  PAYMENT_SUCCESS:      { Icon: CreditCard,    color: 'var(--green)',   bg: 'var(--green-dim)',   tag: 'Payment' },
  PAYMENT_REFUNDED:     { Icon: CreditCard,    color: 'var(--blue)',    bg: 'var(--blue-dim)',    tag: 'Payment' },
};
const DEFAULT_META = { Icon: Bell, color: 'var(--text-secondary)', bg: 'var(--bg-subtle)', tag: 'System' };

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationDrawer() {
  const { notifications, unseenCount, loading, drawerOpen,
          closeDrawer, markSeen, markAllSeen, fetchNotifications } = useNotifications();

  if (!drawerOpen) return null;

  return (
    <div className="overlay" onClick={closeDrawer}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header" style={{ marginBottom: 0 }}>
          <div className="row gap-8">
            <Bell size={16} style={{ color: 'var(--accent)' }} />
            <span className="title-sm">Notifications</span>
            {unseenCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: 'var(--accent-fg)',
                borderRadius: 99, fontSize: 10, fontWeight: 700,
                padding: '1px 7px', fontFamily: 'var(--font-mono)',
              }}>{unseenCount}</span>
            )}
          </div>
          <div className="row gap-6">
            {unseenCount > 0 && (
              <button onClick={markAllSeen} className="btn btn-ghost btn-sm" style={{ gap: 4, fontSize: 11 }}>
                <CheckCheck size={12} /> All read
              </button>
            )}
            <button onClick={fetchNotifications} className="btn btn-ghost btn-icon-sm">
              <RefreshCw size={13} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
            </button>
            <button onClick={closeDrawer} className="btn btn-ghost btn-icon-sm">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
          {loading && notifications.length === 0 ? (
            <div className="center-box" style={{ padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="center-box" style={{ padding: 40 }}>
              <div className="empty-icon-wrap">
                <Bell size={22} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="body-sm text-muted">No notifications yet</div>
            </div>
          ) : (
            notifications.map(n => {
              const m = TYPE_META[n.type] || DEFAULT_META;
              const { Icon } = m;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.seen && markSeen(n.id)}
                  style={{
                    padding: 'var(--sp-12) var(--sp-16)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: 'var(--sp-12)',
                    cursor: n.seen ? 'default' : 'pointer',
                    background: n.seen ? 'transparent' : 'rgba(79,110,247,0.03)',
                    transition: 'background var(--dur)',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    flexShrink: 0, background: m.bg, color: m.color,
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Icon size={15} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-between" style={{ gap: 6, alignItems: 'flex-start', marginBottom: 2 }}>
                      <span style={{ fontWeight: n.seen ? 500 : 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {n.title}
                      </span>
                      {!n.seen && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                      )}
                    </div>
                    <div className="body-xs" style={{ marginBottom: 6, lineHeight: 1.4 }}>{n.body}</div>
                    <div className="row-between">
                      <span style={{
                        fontSize: 10, color: m.color, background: m.bg,
                        padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      }}>{m.tag}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}