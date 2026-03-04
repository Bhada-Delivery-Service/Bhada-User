import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertCircle, ChevronRight, ReceiptText,
} from 'lucide-react';
import { refundsAPI } from '../services/api';

const STATUS = {
  PENDING:  { label: 'Pending',  color: 'var(--orange)', bg: 'var(--orange-dim)', Icon: Clock        },
  REFUNDED: { label: 'Refunded', color: 'var(--green)',  bg: 'var(--green-dim)',  Icon: CheckCircle2 },
  SKIPPED:  { label: 'Skipped',  color: 'var(--red)',    bg: 'var(--red-dim)',    Icon: XCircle      },
};

const fmt     = (n) => Number(n || 0).toFixed(2);
const fmtDate = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true })
  : '—';

function RefundCard({ refund, onClick }) {
  const s = STATUS[refund.status] || STATUS.PENDING;
  const { Icon } = s;
  return (
    <div
      onClick={onClick}
      style={{
        background:'var(--bg-elevated)', border:'1px solid var(--border)',
        borderRadius:'var(--radius)', padding:'14px 16px',
        marginBottom:10, cursor:'pointer',
        display:'flex', alignItems:'center', gap:14,
      }}
    >
      <div style={{ width:42, height:42, borderRadius:'var(--radius-sm)', flexShrink:0, background:s.bg, display:'grid', placeItems:'center' }}>
        <Icon size={18} color={s.color} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-tertiary)' }}>
            #{(refund.orderId || '').slice(-8).toUpperCase()}
          </span>
          <span style={{ fontSize:11, fontWeight:700, color:s.color, background:s.bg, borderRadius:4, padding:'2px 7px', fontFamily:'var(--font-mono)', flexShrink:0 }}>
            {s.label}
          </span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
          <div>
            <span style={{ fontWeight:700, fontSize:16, color: refund.status === 'REFUNDED' ? 'var(--green)' : 'var(--text-primary)' }}>
              ₹{fmt(refund.refundAmount)}
            </span>
            <span style={{ fontSize:11, color:'var(--text-tertiary)', marginLeft:6, fontFamily:'var(--font-mono)' }}>
              of ₹{fmt(refund.originalAmount)}
            </span>
          </div>
          <ChevronRight size={15} color="var(--text-tertiary)" />
        </div>
        <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{fmtDate(refund.createdAt)}</div>
      </div>
    </div>
  );
}

function RefundDetail({ refund, onClose }) {
  const navigate = useNavigate();
  if (!refund) return null;
  const s = STATUS[refund.status] || STATUS.PENDING;
  const { Icon } = s;

  const rows = [
    { label:'Order',            value:`#${(refund.orderId||'').slice(-8).toUpperCase()}` },
    { label:'Original Amount',  value:`₹${fmt(refund.originalAmount)}` },
    { label:'Fee Deducted',     value:`−₹${fmt(refund.deductedAmount)}`, color:'var(--red)' },
    { label:'Refund Amount',    value:`₹${fmt(refund.refundAmount)}`, color: refund.status==='REFUNDED' ? 'var(--green)' : 'var(--text-primary)', bold:true },
    { label:'Payment Mode',     value: refund.paymentMode },
    { label:'Requested On',     value: fmtDate(refund.createdAt) },
    ...(refund.status !== 'PENDING' ? [{ label:'Processed On', value: fmtDate(refund.refundedAt) }] : []),
    ...(refund.refundTransactionRef  ? [{ label:'Transaction Ref', value: refund.refundTransactionRef, mono:true }] : []),
    ...(refund.refundNotes           ? [{ label:'Notes',           value: refund.refundNotes }] : []),
    ...(refund.cancellationReason    ? [{ label:'Cancel Reason',   value: refund.cancellationReason }] : []),
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:'var(--radius-sm)', background:s.bg, display:'grid', placeItems:'center' }}>
              <Icon size={16} color={s.color} />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)' }}>Refund Details</div>
              <div style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.label}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}>✕</button>
        </div>

        {refund.status === 'PENDING' && (
          <div style={{ margin:'4px 16px 0', padding:'10px 14px', background:'color-mix(in srgb, var(--orange) 10%, transparent)', borderRadius:'var(--radius-sm)', borderLeft:'3px solid var(--orange)', fontSize:13, lineHeight:1.5 }}>
            <strong>⏳ Your refund is being processed.</strong><br />
            Our team will credit ₹{fmt(refund.refundAmount)} to your original payment method shortly.
          </div>
        )}
        {refund.status === 'REFUNDED' && (
          <div style={{ margin:'4px 16px 0', padding:'10px 14px', background:'var(--green-dim)', borderRadius:'var(--radius-sm)', borderLeft:'3px solid var(--green)', fontSize:13, lineHeight:1.5 }}>
            <strong>✅ Refund successfully processed!</strong><br />
            ₹{fmt(refund.refundAmount)} has been credited. Please allow 3–5 business days to reflect.
          </div>
        )}
        {refund.status === 'SKIPPED' && (
          <div style={{ margin:'4px 16px 0', padding:'10px 14px', background:'var(--red-dim)', borderRadius:'var(--radius-sm)', borderLeft:'3px solid var(--red)', fontSize:13, lineHeight:1.5 }}>
            <strong>Refund not applicable.</strong><br />
            {refund.refundNotes || 'The refund was not processed for this order.'}
          </div>
        )}

        <div style={{ padding:'16px 16px 0' }}>
          {rows.map(({ label, value, color, bold, mono }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize:13, fontWeight: bold ? 700 : 500, color: color || 'var(--text-primary)', textAlign:'right', fontFamily: mono ? 'var(--font-mono)' : 'inherit', maxWidth:'60%', wordBreak:'break-all' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding:16 }}>
          <button className="btn btn-secondary btn-full" onClick={() => { onClose(); navigate(`/orders/${refund.orderId}`); }}>
            View Order
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RefundsPage() {
  const navigate = useNavigate();
  const [refunds,  setRefunds]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await refundsAPI.getMy();
      setRefunds(data.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const handler = (e) => {
      setRefunds(prev => prev.map(r => r.id === e.detail?.id ? { ...r, ...e.detail } : r));
    };
    window.addEventListener('ws:refund:updated', handler);
    return () => window.removeEventListener('ws:refund:updated', handler);
  }, [load]);

  const FILTERS = [
    { key:'ALL',      label:'All' },
    { key:'PENDING',  label:'Pending' },
    { key:'REFUNDED', label:'Refunded' },
    { key:'SKIPPED',  label:'Skipped' },
  ];

  const filtered     = filter === 'ALL' ? refunds : refunds.filter(r => r.status === filter);
  const pendingCount = refunds.filter(r => r.status === 'PENDING').length;

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex:1 }}>
          <div className="page-title">My Refunds</div>
          {pendingCount > 0 && <div style={{ fontSize:11, color:'var(--orange)', fontWeight:600 }}>{pendingCount} pending</div>}
        </div>
        <button className="btn btn-ghost btn-icon-sm" onClick={load}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{ margin:'0 16px', padding:'10px 14px', background:'var(--blue-dim)', borderRadius:'var(--radius-sm)', borderLeft:'3px solid var(--blue)', fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>
        <AlertCircle size={13} style={{ display:'inline', marginRight:5, color:'var(--blue)', verticalAlign:'middle' }} />
        Refunds are processed manually. Once approved, allow <strong>3–5 business days</strong> to reflect.
      </div>

      <div className="filter-bar" style={{ marginTop:12 }}>
        {FILTERS.map(({ key, label }) => (
          <button key={key} className={`filter-chip ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
            {label}
            {key !== 'ALL' && <span style={{ marginLeft:3, opacity:0.7 }}>({refunds.filter(r => r.status === key).length})</span>}
          </button>
        ))}
      </div>

      <div style={{ padding:'12px 16px' }}>
        {loading ? (
          <div className="center-box" style={{ marginTop:32 }}><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="center-box" style={{ marginTop:40 }}>
            <div className="empty-icon-wrap"><ReceiptText size={24} style={{ color:'var(--text-tertiary)' }} /></div>
            <div className="body-sm text-muted">{filter === 'ALL' ? 'No refund requests yet' : `No ${filter.toLowerCase()} refunds`}</div>
            {filter === 'ALL' && <div className="body-xs text-muted" style={{ marginTop:4, textAlign:'center', maxWidth:220 }}>Refunds are created automatically when you cancel an online payment order.</div>}
          </div>
        ) : (
          filtered.map(r => <RefundCard key={r.id} refund={r} onClick={() => setSelected(r)} />)
        )}
      </div>

      {selected && <RefundDetail refund={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}