import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ArrowRight, Clock, CheckCircle, MapPin, ChevronRight,
  Zap, MessageSquare, FileText, RotateCcw, ShoppingBag, Truck, TrendingUp,
} from 'lucide-react';
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

const QUICK_ACTIONS = [
  { icon: Package,     label: 'Send\nPackage',  color: 'var(--accent)',  bg: 'var(--accent-dim)' },
  { icon: FileText,    label: 'Documents',      color: 'var(--blue)',    bg: 'var(--blue-dim)'   },
  { icon: ShoppingBag, label: 'Groceries',      color: 'var(--green)',   bg: 'var(--green-dim)'  },
  { icon: Zap,         label: 'Express',        color: 'var(--orange)',  bg: 'var(--orange-dim)' },
];

const PROMOS = [
  { id:1, title:'First delivery free!',   sub:'Use code BHADA1 on your first order',       code:'BHADA1', gradient:'linear-gradient(135deg,#4F6EF7,#7C3AED)', emoji:'🎉' },
  { id:2, title:'20% off this weekend',   sub:'Valid Sat–Sun on all orders above ₹200',    code:'WKND20', gradient:'linear-gradient(135deg,#16a34a,#059669)',  emoji:'🏷️' },
  { id:3, title:'Refer & earn ₹50',       sub:'Invite a friend, both get ₹50 credit',      code:null,     gradient:'linear-gradient(135deg,#ea580c,#f59e0b)',  emoji:'👫' },
];

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [promoIdx, setPromoIdx]   = useState(0);
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    ordersAPI.getMyOrders()
      .then(({ data }) => setOrders(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPromoIdx(i => (i + 1) % PROMOS.length), 4200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.orderId) return;
      setOrders(prev => {
        const exists = prev.some(o => o.orderId === updated.orderId);
        if (exists) return prev.map(o => o.orderId === updated.orderId ? { ...o, ...updated } : o);
        ordersAPI.getMyOrders().then(({ data }) => setOrders(data.data || [])).catch(() => {});
        return prev;
      });
    };
    window.addEventListener('ws:order:updated', handler);
    return () => window.removeEventListener('ws:order:updated', handler);
  }, []);

  const active    = orders.filter(o => !['DELIVERED','CANCELLED','DRAFT'].includes(o.status));
  const recent    = orders.filter(o => ['DELIVERED','CANCELLED'].includes(o.status)).slice(0, 3);
  const delivered = orders.filter(o => o.status === 'DELIVERED').length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2200);
    });
  };

  const promo = PROMOS[promoIdx];

  return (
    <div>

      {/* ── Hero: greeting + address bar ── */}
      <div style={{ padding:'var(--sp-20) var(--sp-16) var(--sp-16)', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
          <div>
            <div className="body-xs" style={{ marginBottom:2, color:'var(--text-tertiary)' }}>{greeting()} 👋</div>
            <div className="title-lg">{user?.firstName || user?.phoneNumber?.slice(-4) || 'User'}</div>
          </div>
          {delivered > 0 && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background:'var(--green-dim)', borderRadius:'var(--radius-sm)', padding:'6px 10px', border:'1px solid rgba(22,163,74,0.2)' }}>
              <TrendingUp size={12} style={{ color:'var(--green)', marginBottom:2 }} />
              <span style={{ fontSize:16, fontWeight:800, color:'var(--green)', lineHeight:1, fontFamily:'var(--font-mono)' }}>{delivered}</span>
              <span style={{ fontSize:9, color:'var(--green)', fontWeight:600, marginTop:1 }}>delivered</span>
            </div>
          )}
        </div>

        {/* Address bar */}
        <div
          onClick={() => navigate('/addresses')}
          style={{ display:'flex', alignItems:'center', gap:10, background:'var(--input-bg)', border:'1.5px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', cursor:'pointer' }}
        >
          <MapPin size={15} style={{ color:'var(--accent)', flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', marginBottom:1 }}>DELIVER TO</div>
            <div className="truncate" style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
              {user?.address?.area || user?.address?.city || 'Set your delivery address'}
            </div>
          </div>
          <ChevronRight size={14} style={{ color:'var(--text-tertiary)', flexShrink:0 }} />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'var(--sp-10)', padding:'var(--sp-12) var(--sp-16)', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
        {[
          { icon: Package,     val: orders.length, label:'Total',     color:'var(--accent)' },
          { icon: Clock,       val: active.length,  label:'Active',    color:'var(--orange)' },
          { icon: CheckCircle, val: delivered,      label:'Delivered', color:'var(--green)'  },
        ].map(({ icon: Icon, val, label, color }) => (
          <div key={label} className="stat-card" style={{ cursor:'pointer' }} onClick={() => navigate('/orders')}>
            <Icon size={14} style={{ color, marginBottom:4 }} />
            <div className="stat-value" style={{ color }}>{loading ? '–' : val}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:'var(--sp-16)' }}>

        {/* ── Primary CTA ── */}
        <div
          className="card card-pressable"
          style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))', border:'none', marginBottom:'var(--sp-16)', boxShadow:'0 8px 24px var(--accent-ring)' }}
          onClick={() => navigate('/place-order')}
        >
          <div className="row-between">
            <div>
              <div style={{ fontWeight:800, fontSize:17, color:'#fff', letterSpacing:'-0.02em', marginBottom:3 }}>{t('placeOrder')}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)' }}>Fast doorstep delivery anywhere</div>
            </div>
            <div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.18)', display:'grid', placeItems:'center' }}>
              <Package size={21} color="#fff" />
            </div>
          </div>
          <div className="row gap-4" style={{ marginTop:12, color:'rgba(255,255,255,0.9)', fontSize:12, fontWeight:700 }}>
            Get started <ArrowRight size={13} />
          </div>
        </div>

        {/* ── Quick action chips ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--sp-8)', marginBottom:'var(--sp-20)' }}>
          {QUICK_ACTIONS.map(({ icon: Icon, label, color, bg }) => (
            <button
              key={label}
              onClick={() => navigate('/place-order')}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                padding:'10px 4px', background:'var(--bg-surface)',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
                cursor:'pointer', fontFamily:'var(--font)', transition:'all var(--dur)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=color; e.currentTarget.style.background=bg; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg-surface)'; }}
            >
              <div style={{ width:36, height:36, borderRadius:10, background:bg, display:'grid', placeItems:'center' }}>
                <Icon size={17} style={{ color }} />
              </div>
              <span style={{ fontSize:10, fontWeight:600, color:'var(--text-secondary)', textAlign:'center', lineHeight:1.2, whiteSpace:'pre-wrap' }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Promo banner (auto-rotating) ── */}
        <div style={{ position:'relative', marginBottom:'var(--sp-20)', borderRadius:'var(--radius)', overflow:'hidden' }}>
          <div
            key={promoIdx}
            style={{ background:promo.gradient, borderRadius:'var(--radius)', padding:'var(--sp-16)', display:'flex', alignItems:'center', gap:14, animation:'promoSlide 0.3s ease' }}
          >
            <div style={{ fontSize:30, flexShrink:0, lineHeight:1 }}>{promo.emoji}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff', marginBottom:3 }}>{promo.title}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.82)', lineHeight:1.4 }}>{promo.sub}</div>
              {promo.code && (
                <button
                  onClick={() => copyCode(promo.code)}
                  style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.2)', border:'1px dashed rgba(255,255,255,0.5)', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'var(--font-mono)' }}
                >
                  {copiedCode === promo.code ? '✓ Copied!' : promo.code}
                </button>
              )}
            </div>
          </div>
          {/* Dot indicators */}
          <div style={{ position:'absolute', bottom:10, right:12, display:'flex', gap:4 }}>
            {PROMOS.map((_,i) => (
              <div key={i} onClick={() => setPromoIdx(i)} style={{ width:i===promoIdx?16:5, height:5, borderRadius:99, cursor:'pointer', background:i===promoIdx?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.4)', transition:'all 0.3s' }} />
            ))}
          </div>
        </div>

        {/* ── Active orders ── */}
        {active.length > 0 && (
          <div style={{ marginBottom:'var(--sp-20)' }}>
            <div className="section-head">
              <span className="section-label">{t('activeOrders')}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>{t('viewAll')} <ChevronRight size={12}/></button>
            </div>
            {active.map(o => <OrderCard key={o.orderId} order={o} onClick={() => navigate(`/orders/${o.orderId}`)} />)}
          </div>
        )}

        {/* ── Recent deliveries ── */}
        {recent.length > 0 && (
          <div style={{ marginBottom:'var(--sp-20)' }}>
            <div className="section-head">
              <span className="section-label">Recent Deliveries</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>{t('viewAll')} <ChevronRight size={12}/></button>
            </div>
            {recent.map(o => (
              <OrderCard key={o.orderId} order={o} onClick={() => navigate(`/orders/${o.orderId}`)} showReorder onReorder={() => navigate('/place-order')} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && orders.length === 0 && (
          <div className="center-box" style={{ marginTop:'var(--sp-32)' }}>
            <div style={{ width:80, height:80, background:'var(--accent-dim)', borderRadius:'50%', display:'grid', placeItems:'center', marginBottom:8, border:'1px solid var(--accent-ring)' }}>
              <Truck size={34} style={{ color:'var(--accent)' }} />
            </div>
            <div className="title-sm" style={{ marginBottom:6, textAlign:'center' }}>{t('noOrders')}</div>
            <div className="body-xs" style={{ textAlign:'center', marginBottom:20 }}>{t('placeFirstOrder')}</div>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/place-order')}>
              <Package size={16} /> Place your first order
            </button>
          </div>
        )}

        {/* ── Feedback banner ── */}
        <div style={{ marginTop:'var(--sp-24)' }}>
          <button
            onClick={() => navigate('/feedback')}
            style={{ width:'100%', background:'var(--bg-surface)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'var(--sp-16)', cursor:'pointer', display:'flex', alignItems:'center', gap:'var(--sp-12)', textAlign:'left' }}
          >
            <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, background:'var(--accent-dim)', display:'grid', placeItems:'center' }}>
              <MessageSquare size={20} style={{ color:'var(--accent)' }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:2 }}>Share Feedback or a Suggestion</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.4 }}>Help us improve — your voice shapes our service</div>
            </div>
            <ChevronRight size={16} style={{ color:'var(--text-tertiary)', flexShrink:0 }} />
          </button>
        </div>

        <div style={{ height:8 }} />
      </div>
    </div>
  );
}

function OrderCard({ order, onClick, showReorder, onReorder }) {
  const cfg    = STATUS_CONFIG[order.status] || STATUS_CONFIG.PLACED;
  const pickup = order.senderNode?.area || order.senderNode?.city || '—';
  const drop   = order.receiverNode?.area || order.receiverNode?.city || '—';
  const isActive = !['DELIVERED','CANCELLED'].includes(order.status);

  return (
    <div
      className="card card-pressable"
      style={{ marginBottom:'var(--sp-10)', borderLeft: isActive ? `3px solid ${cfg.dot}` : '1px solid var(--border)', paddingLeft: isActive ? 13 : 16 }}
      onClick={onClick}
    >
      <div className="row-between" style={{ marginBottom:'var(--sp-8)' }}>
        <span className="mono" style={{ fontSize:11, color:'var(--text-tertiary)' }}>#{(order.orderId||'').slice(-8).toUpperCase()}</span>
        <span className={`badge ${cfg.cls}`}><span className="badge-dot"/>{cfg.label}</span>
      </div>
      <div className="order-card-route">
        <span className="route-dot" style={{ background:'var(--green)' }} />
        <span className="truncate" style={{ flex:1 }}>{pickup}</span>
        <ArrowRight size={11} style={{ color:'var(--text-tertiary)', flexShrink:0 }} />
        <span className="route-dot" style={{ background:'var(--red)' }} />
        <span className="truncate" style={{ flex:1 }}>{drop}</span>
      </div>
      <div className="row-between" style={{ marginTop:'var(--sp-8)' }}>
        <div className="row gap-10">
          <span className="body-xs">{order.items?.length||0} item{(order.items?.length||0)!==1?'s':''}</span>
          {order.billing?.payableAmount && (
            <span className="mono" style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>₹{order.billing.payableAmount}</span>
          )}
        </div>
        {showReorder && order.status === 'DELIVERED' && (
          <button
            onClick={e => { e.stopPropagation(); onReorder?.(); }}
            style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'var(--accent)', background:'var(--accent-dim)', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:'var(--font)' }}
          >
            <RotateCcw size={10}/> Reorder
          </button>
        )}
      </div>
    </div>
  );
}
