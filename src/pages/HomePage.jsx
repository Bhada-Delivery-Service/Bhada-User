import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ArrowRight, Clock, CheckCircle, MapPin, ChevronRight, Zap } from 'lucide-react';
import { ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/Langcontext';

const STATUS_CONFIG = {
  DRAFT:      { label: 'Draft',      cls: 'badge-draft',      dot: 'var(--text-tertiary)' },
  PLACED:     { label: 'Placed',     cls: 'badge-placed',     dot: 'var(--blue)'   },
  READY:      { label: 'Ready',      cls: 'badge-ready',      dot: 'var(--orange)' },
  DISPATCHED: { label: 'On the way', cls: 'badge-dispatched', dot: 'var(--purple)' },
  DELIVERED:  { label: 'Delivered',  cls: 'badge-delivered',  dot: 'var(--green)'  },
  CANCELLED:  { label: 'Cancelled',  cls: 'badge-cancelled',  dot: 'var(--red)'    },
};

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersAPI.getMyOrders()
      .then(({ data }) => setOrders(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active  = orders.filter(o => !['DELIVERED','CANCELLED','DRAFT'].includes(o.status));
  const recent  = orders.filter(o => ['DELIVERED','CANCELLED'].includes(o.status)).slice(0, 3);
  const delivered = orders.filter(o => o.status === 'DELIVERED').length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div>
      {/* Hero greeting */}
      <div style={{
        padding: 'var(--sp-20) var(--sp-16) var(--sp-16)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="body-xs" style={{ marginBottom: 2 }}>
          {greeting()} 👋
        </div>
        <div className="title-lg">
          {user?.firstName || user?.phoneNumber?.slice(-4) || 'User'}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-10)',
        padding: 'var(--sp-16)', background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { icon: Package,      val: orders.length, label: 'Total',     color: 'var(--accent)' },
          { icon: Clock,        val: active.length,  label: 'Active',    color: 'var(--orange)' },
          { icon: CheckCircle,  val: delivered,      label: 'Delivered', color: 'var(--green)'  },
        ].map(({ icon: Icon, val, label, color }) => (
          <div key={label} className="stat-card">
            <Icon size={14} style={{ color, marginBottom: 4 }} />
            <div className="stat-value" style={{ color }}>{loading ? '–' : val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 'var(--sp-16)' }}>
        {/* CTA */}
        <div
          className="card card-pressable"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            border: 'none', marginBottom: 'var(--sp-20)',
            boxShadow: '0 8px 24px var(--accent-ring)',
          }}
          onClick={() => navigate('/place-order')}
        >
          <div className="row-between">
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.02em', marginBottom: 3 }}>
                {t('placeOrder')}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                Fast doorstep delivery anywhere
              </div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.18)',
              display: 'grid', placeItems: 'center',
            }}>
              <Package size={21} color="#fff" />
            </div>
          </div>
          <div className="row gap-4" style={{ marginTop: 12, color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700 }}>
            Get started <ArrowRight size={13} />
          </div>
        </div>

        {/* Active orders */}
        {active.length > 0 && (
          <div style={{ marginBottom: 'var(--sp-20)' }}>
            <div className="section-head">
              <span className="section-label">{t('activeOrders')}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>
                {t('viewAll')} <ChevronRight size={12} />
              </button>
            </div>
            {active.map(o => <OrderCard key={o.orderId} order={o} onClick={() => navigate(`/orders/${o.orderId}`)} />)}
          </div>
        )}

        {/* Recent deliveries */}
        {recent.length > 0 && (
          <div>
            <div className="section-head">
              <span className="section-label">Recent Deliveries</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>
                {t('viewAll')} <ChevronRight size={12} />
              </button>
            </div>
            {recent.map(o => <OrderCard key={o.orderId} order={o} onClick={() => navigate(`/orders/${o.orderId}`)} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && orders.length === 0 && (
          <div className="center-box" style={{ marginTop: 'var(--sp-32)' }}>
            <div className="empty-icon-wrap">
              <Package size={28} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div>
              <div className="title-sm" style={{ marginBottom: 4 }}>{t('noOrders')}</div>
              <div className="body-xs" style={{ textAlign: 'center' }}>{t('placeFirstOrder')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onClick }) {
  const cfg    = STATUS_CONFIG[order.status] || STATUS_CONFIG.PLACED;
  const pickup = order.senderNode?.area || order.senderNode?.city || '—';
  const drop   = order.receiverNode?.area || order.receiverNode?.city || '—';

  return (
    <div className="card card-pressable" style={{ marginBottom: 'var(--sp-10)' }} onClick={onClick}>
      <div className="row-between" style={{ marginBottom: 'var(--sp-8)' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          #{(order.orderId || '').slice(-8).toUpperCase()}
        </span>
        <span className={`badge ${cfg.cls}`}>
          <span className="badge-dot" />
          {cfg.label}
        </span>
      </div>
      <div className="order-card-route">
        <span className="route-dot" style={{ background: 'var(--green)' }} />
        <span className="truncate" style={{ flex: 1 }}>{pickup}</span>
        <ArrowRight size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span className="route-dot" style={{ background: 'var(--red)' }} />
        <span className="truncate" style={{ flex: 1 }}>{drop}</span>
      </div>
      <div className="row gap-10" style={{ marginTop: 'var(--sp-6)' }}>
        <span className="body-xs">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
        {order.billing?.totalAmount && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
            ₹{order.billing.totalAmount}
          </span>
        )}
      </div>
    </div>
  );
}