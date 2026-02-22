import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, ChevronRight, AlertTriangle, Upload, X, Check } from 'lucide-react';
import { disputesAPI, ordersAPI } from '../services/api';

const REASONS = [
  'ITEM_DAMAGED','ITEM_MISSING','WRONG_ITEM_DELIVERED',
  'LATE_DELIVERY','RIDER_BEHAVIOUR','PAYMENT_ISSUE','OTHER',
];

const REASON_LABELS = {
  ITEM_DAMAGED: 'Item Damaged',
  ITEM_MISSING: 'Item Missing',
  WRONG_ITEM_DELIVERED: 'Wrong Item',
  LATE_DELIVERY: 'Late Delivery',
  RIDER_BEHAVIOUR: 'Rider Behaviour',
  PAYMENT_ISSUE: 'Payment Issue',
  OTHER: 'Other',
};

const STATUS_STYLE = {
  OPEN:         { color: 'var(--orange)', bg: 'var(--orange-dim)', cls: 'badge-open'     },
  UNDER_REVIEW: { color: 'var(--blue)',   bg: 'var(--blue-dim)',   cls: 'badge-placed'   },
  RESOLVED:     { color: 'var(--green)',  bg: 'var(--green-dim)',  cls: 'badge-resolved' },
  REJECTED:     { color: 'var(--red)',    bg: 'var(--red-dim)',    cls: 'badge-cancelled'},
  CLOSED:       { color: 'var(--text-tertiary)', bg: 'var(--bg-subtle)', cls: 'badge-draft' },
};

// ─── Disputes List ─────────────────────────────────────────────────────────────
export default function DisputesPage() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = () => {
    setLoading(true);
    disputesAPI.getMyDisputes()
      .then(({ data }) => setDisputes(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--sp-16)', background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div className="title-sm">Disputes</div>
        <div className="row gap-8">
          <button className="btn btn-ghost btn-icon-sm" onClick={load}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/disputes/raise')}>
            <Plus size={13} /> Raise
          </button>
        </div>
      </div>

      <div style={{ padding: 'var(--sp-16)' }}>
        {loading ? (
          <div className="center-box"><div className="spinner spinner-lg" /></div>
        ) : disputes.length === 0 ? (
          <div className="center-box" style={{ marginTop: 'var(--sp-32)' }}>
            <div className="empty-icon-wrap">
              <AlertTriangle size={26} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div>
              <div className="title-sm" style={{ marginBottom: 4 }}>No disputes raised</div>
              <div className="body-xs" style={{ textAlign: 'center', marginBottom: 'var(--sp-16)' }}>
                Had an issue with a delivery? Raise a dispute and we'll look into it.
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/disputes/raise')}>
              <AlertTriangle size={14} /> Raise a Dispute
            </button>
          </div>
        ) : (
          disputes.map(d => {
            const s = STATUS_STYLE[d.status] || STATUS_STYLE.OPEN;
            return (
              <div
                key={d.disputeId}
                className="card card-pressable"
                style={{ marginBottom: 'var(--sp-10)' }}
                onClick={() => navigate(`/disputes/${d.disputeId}`)}
              >
                <div className="row-between" style={{ marginBottom: 'var(--sp-8)' }}>
                  <span className={`badge ${s.cls}`}>
                    <span className="badge-dot" />
                    {d.status?.replace(/_/g, ' ')}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div className="body-sm font-semibold" style={{ marginBottom: 3, color: 'var(--text-primary)' }}>
                  {REASON_LABELS[d.reason] || d.reason?.replace(/_/g, ' ')}
                </div>
                {d.description && (
                  <div className="body-xs" style={{ marginBottom: 'var(--sp-8)', lineHeight: 1.4 }}>
                    {d.description.slice(0, 90)}{d.description.length > 90 ? '…' : ''}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Order #{(d.orderId || '').slice(-8).toUpperCase()} · {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : ''}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Raise Dispute ─────────────────────────────────────────────────────────────
export function RaiseDisputePage() {
  const navigate = useNavigate();
  const [orders,      setOrders]      = useState([]);
  const [orderId,     setOrderId]     = useState('');
  const [reason,      setReason]      = useState('OTHER');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    ordersAPI.getMyOrders()
      .then(({ data }) => setOrders((data.data || []).filter(o => o.status !== 'DRAFT')))
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!orderId) { setError('Please select an order'); return; }
    if (!description.trim()) { setError('Please describe the issue'); return; }
    setSubmitting(true); setError('');
    try {
      await disputesAPI.raise({ orderId, reason, description });
      navigate('/disputes', { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to raise dispute');
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="page-title">Raise a Dispute</div>
          <div className="page-subtitle">We'll look into it within 24 hours</div>
        </div>
      </div>

      <div style={{ padding: 'var(--sp-16)' }}>
        {/* Order */}
        <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>Select Order</div>
          <select
            className="input"
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
          >
            <option value="">— Choose an order —</option>
            {orders.map(o => (
              <option key={o.orderId} value={o.orderId}>
                #{(o.orderId || '').slice(-8).toUpperCase()} · {o.senderNode?.city} → {o.receiverNode?.city}
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>Issue Type</div>
          <div className="reason-grid">
            {REASONS.map(r => (
              <div
                key={r}
                className={`reason-chip ${reason === r ? 'selected' : ''}`}
                onClick={() => setReason(r)}
              >
                {reason === r && <Check size={11} style={{ marginRight: 3 }} />}
                {REASON_LABELS[r]}
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>Description</div>
          <textarea
            className="input input-textarea"
            placeholder="Describe what happened in detail…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-12)' }}>⚠ {error}</div>}

        <button className="btn btn-primary btn-full btn-lg" onClick={submit} disabled={submitting}>
          {submitting ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2,borderTopColor:'#fff' }} /> Submitting…</> : 'Submit Dispute'}
        </button>
      </div>
    </div>
  );
}

// ─── Dispute Detail ─────────────────────────────────────────────────────────────
export function DisputeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    disputesAPI.getById(id)
      .then(({ data }) => setDispute(data.data || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const s = STATUS_STYLE[dispute?.status] || STATUS_STYLE.OPEN;

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div className="page-title">Dispute Details</div>
      </div>

      {loading ? (
        <div className="center-box" style={{ marginTop: 60 }}><div className="spinner spinner-lg" /></div>
      ) : !dispute ? (
        <div className="center-box"><div className="body-sm text-muted">Dispute not found</div></div>
      ) : (
        <div style={{ padding: 'var(--sp-16)' }}>
          {/* Status */}
          <div className="card" style={{ marginBottom: 'var(--sp-12)', textAlign: 'center', padding: 'var(--sp-20)' }}>
            <span className={`badge ${s.cls}`} style={{ fontSize: 13, padding: '6px 16px' }}>
              <span className="badge-dot" />
              {dispute.status?.replace(/_/g, ' ')}
            </span>
            <div className="title-sm" style={{ marginTop: 'var(--sp-12)', marginBottom: 4 }}>
              {REASON_LABELS[dispute.reason] || dispute.reason?.replace(/_/g, ' ')}
            </div>
            <div className="mono body-xs">
              Raised {dispute.createdAt ? new Date(dispute.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : ''}
            </div>
          </div>

          {/* Details */}
          <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
            {[
              { label: 'Order ID', val: `#${(dispute.orderId || '').slice(-8).toUpperCase()}`, mono: true },
              { label: 'Dispute ID', val: `#${(dispute.disputeId || '').slice(-8).toUpperCase()}`, mono: true },
            ].map(({ label, val, mono }) => (
              <div key={label} className="summary-row">
                <span className="key">{label}</span>
                <span className="val" style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: 12 }}>{val}</span>
              </div>
            ))}
            {dispute.description && (
              <div style={{ paddingTop: 'var(--sp-10)' }}>
                <div className="label-sm" style={{ marginBottom: 6 }}>Description</div>
                <div className="body-sm" style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>{dispute.description}</div>
              </div>
            )}
          </div>

          {/* Resolution */}
          {dispute.resolution && (
            <div className="card alert-success" style={{ marginBottom: 'var(--sp-12)' }}>
              <div className="label-sm" style={{ marginBottom: 6, color: 'var(--green)' }}>Resolution</div>
              <div className="body-sm">{dispute.resolution}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}