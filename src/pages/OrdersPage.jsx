import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
   MapPin, ArrowRight, Package, CheckCircle, Clock, Truck,
  XCircle, ArrowLeft, RefreshCw, Copy, ExternalLink, Check,
  CreditCard, AlertCircle, Star, QrCode, Banknote, Smartphone,
} from 'lucide-react';
import { ordersAPI, refundsAPI, ridersAPI, codPaymentsAPI } from '../services/api';
import { useLang } from '../context/Langcontext';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', cls: 'badge-draft', icon: Package },
  PLACED: { label: 'Placed', cls: 'badge-placed', icon: Clock },
  READY: { label: 'Ready', cls: 'badge-ready', icon: CheckCircle },
  DISPATCHED: { label: 'On the Way', cls: 'badge-dispatched', icon: Truck },
  DELIVERED: { label: 'Delivered', cls: 'badge-delivered', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', cls: 'badge-cancelled', icon: XCircle },
};

/**
 * For PLACED orders, returns a richer label/hint based on assignedRiderId + senderReady flags.
 * Because both flags are independent, there are 4 states inside PLACED:
 *   1. No rider, not ready  → searching
 *   2. Rider assigned, not ready → sender must mark ready
 *   3. No rider, sender ready → packed, waiting for rider
 *   4. Both set → transitioning to READY (edge case, backend will move to READY)
 */
function getPlacedSubState(order) {
  const hasRider = !!order.assignedRiderId;
  const senderDone = !!order.senderReady;
  if (hasRider && !senderDone)
    return {
      label: 'Rider Assigned — Pack Now', cls: 'badge-placed',
      hint: 'A rider accepted your order. Please pack the package and tap Mark Ready.'
    };
  if (!hasRider && senderDone)
    return {
      label: 'Packed — Finding Rider', cls: 'badge-placed',
      hint: 'Package marked ready! Still searching for an available rider.'
    };
  if (hasRider && senderDone)
    return {
      label: 'Ready for Pickup', cls: 'badge-ready',
      hint: 'Both done — rider is heading to you for pickup!'
    };
  return {
    label: 'Placed — Finding Rider', cls: 'badge-placed',
    hint: 'Your order is placed. Searching for an available rider.'
  };
}

const TIMELINE = [
  { status: 'PLACED', label: 'Order Placed', sub: 'Searching for a rider' },
  { status: 'READY', label: 'Ready for Pickup', sub: 'Rider assigned and package ready' },
  { status: 'DISPATCHED', label: 'Out for Delivery', sub: 'Parcel picked up, en route to receiver' },
  { status: 'DELIVERED', label: 'Delivered', sub: 'Parcel delivered successfully' },
];
const STATUS_ORDER = ['PLACED', 'READY', 'DISPATCHED', 'DELIVERED'];

const GMAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const existing = document.getElementById('gmap-script');
    if (existing) { existing.addEventListener('load', () => resolve(window.google.maps)); return; }
    const s = document.createElement('script');
    s.id = 'gmap-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAP_KEY}&libraries=places`;
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function RouteMap({ pickupLat, pickupLng, dropLat, dropLng, riderLat, riderLng, status }) {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) return;
    loadGoogleMaps().then(maps => {
      const pickupPos = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
      const dropPos = { lat: parseFloat(dropLat), lng: parseFloat(dropLng) };

      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const map = new maps.Map(mapRef.current, {
        zoom: 12, center: pickupPos, disableDefaultUI: true, zoomControl: true,
        styles: isDark ? [
          { elementType: 'geometry', stylers: [{ color: '#13161f' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8b93a8' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1e2a' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c0e14' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        ] : [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        ],
      });

      new maps.Marker({ position: pickupPos, map, title: 'Pickup', icon: { path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#16a34a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }, label: { text: 'P', color: '#fff', fontSize: '9px', fontWeight: 'bold' } });
      new maps.Marker({ position: dropPos, map, title: 'Drop', icon: { path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#dc2626', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }, label: { text: 'D', color: '#fff', fontSize: '9px', fontWeight: 'bold' } });

      if (riderLat && riderLng && status === 'DISPATCHED') {
        new maps.Marker({ position: { lat: parseFloat(riderLat), lng: parseFloat(riderLng) }, map, title: 'Rider', icon: { path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', fillColor: '#4F6EF7', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1, scale: 1.4, anchor: new maps.Point(12, 24) } });
      }

      const ds = new maps.DirectionsService();
      const dr = new maps.DirectionsRenderer({ map, suppressMarkers: true, polylineOptions: { strokeColor: '#4F6EF7', strokeOpacity: 0.8, strokeWeight: 3 } });
      ds.route({ origin: pickupPos, destination: dropPos, travelMode: maps.TravelMode.DRIVING }, (result, s) => {
        if (s === 'OK') dr.setDirections(result);
        else new maps.Polyline({ path: [pickupPos, dropPos], map, strokeColor: '#4F6EF7', strokeOpacity: 0.5, strokeWeight: 2 });
      });

      const bounds = new maps.LatLngBounds();
      bounds.extend(pickupPos); bounds.extend(dropPos);
      if (riderLat && riderLng) bounds.extend({ lat: parseFloat(riderLat), lng: parseFloat(riderLng) });
      map.fitBounds(bounds, 20);
      setReady(true);
    }).catch(() => { });
  }, [pickupLat, pickupLng, dropLat, dropLng, riderLat, riderLng]);

  if (!pickupLat || !pickupLng || !dropLat || !dropLng) return null;

  return (
    <div className="map-container" style={{ height: 190 }}>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--bg-elevated)', zIndex: 1 }}>
          <div className="spinner" />
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <div className="map-legend">
        <span style={{ color: '#16a34a' }}>● Pickup</span>
        <span style={{ color: '#dc2626' }}>● Drop</span>
        {riderLat && riderLng && status === 'DISPATCHED' && <span style={{ color: '#4F6EF7' }}>● Rider</span>}
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&origin=${pickupLat},${pickupLng}&destination=${dropLat},${dropLng}&travelmode=driving`}
        target="_blank" rel="noopener noreferrer"
        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
      >
        <ExternalLink size={10} /> Maps
      </a>
    </div>
  );
}

/* ─── Orders List ───────────────────────────────────────────────────────────── */
export function OrdersPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersAPI.getMyOrders()
      .then(({ data }) => setOrders(data.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  // Real-time: update order badge/status in list
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.orderId) return;
      setOrders(prev => prev.map(o => o.orderId === updated.orderId ? { ...o, ...updated } : o));
    };
    window.addEventListener('ws:order:updated', handler);
    return () => window.removeEventListener('ws:order:updated', handler);
  }, []);

  const FILTERS = [
    { key: 'ALL', label: t('all') },
    { key: 'PLACED', label: t('placed') },
    { key: 'DISPATCHED', label: t('onTheWay') },
    { key: 'DELIVERED', label: t('delivered') },
    { key: 'CANCELLED', label: t('cancelled') },
  ];

  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter);

  return (
    <div>
      {/* Sticky header + filters */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: 'var(--sp-16)', borderBottom: '1px solid var(--border)' }}>
          <div className="title-sm">{t('myOrders')}</div>
        </div>
        <div className="filter-bar">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`filter-chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {key !== 'ALL' && <span style={{ marginLeft: 3, opacity: 0.7 }}>({orders.filter(o => o.status === key).length})</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 'var(--sp-12) var(--sp-16)' }}>
        {loading ? (
          <div className="center-box"><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="center-box" style={{ marginTop: 'var(--sp-32)' }}>
            <div className="empty-icon-wrap"><Package size={24} style={{ color: 'var(--text-tertiary)' }} /></div>
            <div className="body-sm text-muted">{t('noOrdersYet')}</div>
          </div>
        ) : (
          filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PLACED;
            const pickup = order.senderNode?.area || order.senderNode?.city || '—';
            const drop = order.receiverNode?.area || order.receiverNode?.city || '—';
            return (
              <div key={order.orderId} className="card card-pressable" style={{ marginBottom: 'var(--sp-10)' }}
                onClick={() => navigate(`/orders/${order.orderId}`)}>
                <div className="row-between" style={{ marginBottom: 'var(--sp-8)' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    #{(order.orderId || '').slice(-8).toUpperCase()}
                  </span>
                  <span className={`badge ${cfg.cls}`}><span className="badge-dot" />{cfg.label}</span>
                </div>
                <div className="order-card-route">
                  <span className="route-dot" style={{ background: 'var(--green)' }} />
                  <span className="truncate" style={{ flex: 1 }}>{pickup}</span>
                  <ArrowRight size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  <span className="route-dot" style={{ background: 'var(--red)' }} />
                  <span className="truncate" style={{ flex: 1 }}>{drop}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--sp-6)' }}>
                  {(order.billing?.payableAmount || order.billing?.subtotalAmount) && (
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      ₹{Number(order.billing.payableAmount || order.billing.subtotalAmount).toFixed(2)}
                    </div>
                  )}
                  {order.billing?.paymentMode === 'COD' && !['CANCELLED','DELIVERED'].includes(order.status) && (
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em',
                      background: order.billing?.status === 'PAID' ? 'var(--green-dim)' : 'var(--orange-dim)',
                      color: order.billing?.status === 'PAID' ? 'var(--green)' : 'var(--orange)',
                    }}>
                      {order.billing?.status === 'PAID' ? '✓ PAID' : '💳 COD'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Order Detail ──────────────────────────────────────────────────────────── */
export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickupOtp, setPickupOtp] = useState('');
  const [handingOver, setHandingOver] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [markingReady, setMarkingReady] = useState(false);
  const [refund, setRefund] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  // COD digital payment
  const [codPayment, setCodPayment] = useState(null);
  const [codLoading, setCodLoading] = useState(false);
  const [payNowBusy, setPayNowBusy] = useState(false);

  // Load COD payment data when order is COD
  const loadCodPayment = () => {
    if (!id) return;
    codPaymentsAPI.getByOrder(id)
      .then(({ data }) => setCodPayment(data.data || data))
      .catch(() => {})
      .finally(() => setCodLoading(false));
  };

  // Razorpay Pay Now handler
  const handlePayNow = () => {
    if (!codPayment?.razorpayOrderId || !window.Razorpay) return;
    setPayNowBusy(true);
    const rzp = new window.Razorpay({
      key:      import.meta.env.VITE_RAZORPAY_KEY_ID,
      order_id: codPayment.razorpayOrderId,
      amount:   Math.round(codPayment.amount * 100),
      currency: 'INR',
      name:     'Bhada',
      description: `COD Payment – Order #${id.slice(-8).toUpperCase()}`,
      handler: async (response) => {
        try {
          await codPaymentsAPI.verify(id, {
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          setCodPayment(prev => prev ? { ...prev, paymentStatus: 'PAID' } : prev);
          showToast('✓ Payment successful! Thank you.');
        } catch { showToast('✗ Verification failed. Contact support.'); }
        finally { setPayNowBusy(false); }
      },
      modal: { ondismiss: () => setPayNowBusy(false) },
      prefill: {
        name:    [order?.sender?.firstName, order?.sender?.lastName].filter(Boolean).join(' '),
        contact: order?.sender?.phoneNumber || '',
      },
      theme: { color: '#4F6EF7' },
    });
    rzp.open();
  };

  const load = () => {
    setLoading(true);
    ordersAPI.getById(id)
      .then(({ data }) => setOrder(data.data || data))
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  const loadRefund = () => {
    setRefundLoading(true);
    refundsAPI.getByOrder(id)
      .then(({ data }) => setRefund(data.data || null))
      .catch(() => setRefund(null))
      .finally(() => setRefundLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  // Check if user already rated this order (persisted in localStorage)
  useEffect(() => {
    if (id) {
      const stored = localStorage.getItem(`rated_order_${id}`);
      if (stored) setRatingDone(true);
    }
  }, [id]);
  useEffect(() => {
    // Only load refund for orders that were actually PLACED (have a placedAt timestamp).
    // DRAFT orders were never paid — server won't create a refund for them after our fix.
    const wasDraft = !order?.placedAt;
    if (order?.status === 'CANCELLED' && order?.billing?.paymentMode !== 'COD' && !wasDraft) {
      loadRefund();
    }
  }, [order?.status, id]);

  // Load COD payment when order is COD
  useEffect(() => {
    if (order?.billing?.paymentMode === 'COD' && id) {
      if (codPayment?.paymentStatus !== 'PAID') {
        setCodLoading(true);
        loadCodPayment();
      }
    }
  }, [order?.status, id]);

  // Real-time: COD payment confirmed
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.orderId !== id) return;
      setCodPayment(prev => prev
        ? { ...prev, paymentStatus: 'PAID', paymentAt: new Date().toISOString() }
        : { paymentStatus: 'PAID', orderId: id });
      showToast('✓ COD payment received! Order is now paid.');
    };
    window.addEventListener('ws:cod:payment_received', handler);
    return () => window.removeEventListener('ws:cod:payment_received', handler);
  }, [id]);

  // Real-time: refresh order + refund when socket fires
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.orderId === id || e.detail?.id === id) load();
    };
    const refundHandler = (e) => {
      if (e.detail?.orderId === id) {
        setRefund(prev => prev ? { ...prev, ...e.detail } : e.detail);
        showToast('✓ Your refund status has been updated!');
      }
    };
    window.addEventListener('ws:order:updated', handler);
    window.addEventListener('ws:refund:updated', refundHandler);
    return () => {
      window.removeEventListener('ws:order:updated', handler);
      window.removeEventListener('ws:refund:updated', refundHandler);
    };
  }, [id]);

  useEffect(() => { load(); }, [id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleRating = async () => {
    if (!ratingStars) { showToast('Please select a star rating'); return; }
    setRatingSubmitting(true);
    try {
      await ridersAPI.rate(order.assignedRiderId, ratingStars, ratingComment, id);
      localStorage.setItem(`rated_order_${id}`, '1');
      setRatingDone(true);
      showToast('✓ Thanks for rating your rider!');
    } catch (e) {
      showToast('✗ ' + (e.response?.data?.message || 'Failed to submit rating'));
    } finally { setRatingSubmitting(false); }
  };

  const handleMarkReady = async () => {
    setMarkingReady(true);
    try {
      const { data } = await ordersAPI.markReady(id);
      setOrder(data.data || data);
      showToast('Package marked as ready! Rider will be notified.');
    } catch (e) {
      showToast('Failed: ' + (e.response?.data?.message || e.message));
    } finally { setMarkingReady(false); }
  };

  const handover = async () => {
    if (!pickupOtp || pickupOtp.length < 4) { showToast('Enter the pickup OTP'); return; }
    setHandingOver(true);
    try {
      const { data } = await ordersAPI.handover(id, pickupOtp);
      setOrder(data.data || data);
      showToast('✓ Order handed over to rider!');
    } catch (e) { showToast('✗ ' + (e.response?.data?.message || 'Invalid OTP')); }
    finally { setHandingOver(false); }
  };

  const cancel = async () => {
    if (!cancelReason.trim()) { showToast('Please enter a reason'); return; }
    setCancelling(true);
    try { await ordersAPI.cancel(id, cancelReason); load(); setShowCancel(false); }
    catch (e) { showToast('✗ ' + (e.response?.data?.message || 'Failed')); }
    finally { setCancelling(false); }
  };

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div className="spinner spinner-lg" />
    </div>
  );
  if (!order) return (
    <div className="center-box"><div className="body-sm text-muted">{t('orderNotFound')}</div></div>
  );

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PLACED;
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const placedSub = order.status === 'PLACED' ? getPlacedSubState(order) : null;
  const canCancel = ['PLACED', 'DRAFT'].includes(order.status);
  const canHandover = order.status === 'READY';
  // Fix 1: Allow sender to mark ready any time order is PLACED (with or without rider assigned)
  const canMarkReady = order.status === 'PLACED' && !order.senderReady;
  // Fix 3: Show drop OTP to receiver when order is DISPATCHED
  const showDropOtp = order.status === 'DISPATCHED' && order.dropOtp;

  const pickupLat = order.senderNode?.latitude;
  const pickupLng = order.senderNode?.longitude;
  const dropLat = order.receiverNode?.latitude;
  const dropLng = order.receiverNode?.longitude;
  const riderLat = order.riderLocation?.latitude || order.rider?.latitude;
  const riderLng = order.riderLocation?.longitude || order.rider?.longitude;

  const addrStr = (node) => [node?.buildingOrFlat, node?.street, node?.area, node?.city].filter(Boolean).join(', ');

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="toast-stack">
          <div className={`toast ${toast.startsWith('✓') ? 'alert-success' : 'alert-error'}`}>{toast}</div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="page-title">{t('orderDetails')}</div>
          <div className="page-subtitle mono">#{(order.orderId || '').slice(-8).toUpperCase()}</div>
        </div>
        <button className="btn btn-ghost btn-icon-sm" onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ padding: 'var(--sp-16)' }}>
        {/* Status card */}
        <div className="card" style={{ marginBottom: 'var(--sp-12)', textAlign: 'center', padding: 'var(--sp-20)' }}>
          <span className={`badge ${placedSub ? placedSub.cls : cfg.cls}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            <span className="badge-dot" />{placedSub ? placedSub.label : cfg.label}
          </span>
          {placedSub?.hint && (
            <div className="body-xs" style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-8)', lineHeight: 1.5 }}>
              {placedSub.hint}
            </div>
          )}
          {order.updatedAt && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--sp-8)' }}>
              {new Date(order.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Tracking */}
        {order.status !== 'CANCELLED' && order.status !== 'DRAFT' && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
            <div className="label-sm" style={{ marginBottom: 'var(--sp-14)' }}>Tracking</div>
            <div className="timeline">
              {TIMELINE.map((ts, i) => {
                const done = STATUS_ORDER.indexOf(ts.status) <= currentIdx;
                const active = ts.status === order.status;
                const isLast = i === TIMELINE.length - 1;
                return (
                  <div key={ts.status} className="timeline-item">
                    <div className="timeline-left">
                      <div className={`timeline-dot ${done ? 'done' : active ? 'active' : ''}`}>
                        {done && <Check size={10} color="#fff" />}
                      </div>
                      {!isLast && <div className={`timeline-line ${done ? 'done' : ''}`} />}
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-title" style={{ opacity: done || active ? 1 : 0.4 }}>{ts.label}</div>
                      <div className="timeline-sub">{ts.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Rider Info Card — shown any time a rider is assigned (PLACED→DISPATCHED) ── */}
        {order.assignedRiderId && !['DELIVERED', 'CANCELLED', 'DRAFT'].includes(order.status) && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
            <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>Your Rider</div>
            {order.assignedRider ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>🛵</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                    {[order.assignedRider.firstName, order.assignedRider.lastName].filter(Boolean).join(' ') || 'Your Rider'}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    {order.assignedRider.phoneNumber}
                    {order.assignedRider.rating != null && (
                      <span> · ⭐ {Number(order.assignedRider.rating).toFixed(1)}</span>
                    )}
                  </div>
                  {order.riderAcceptedAt && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Accepted at {new Date(order.riderAcceptedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                {order.assignedRider.phoneNumber && (
                  <a
                    href={`tel:${order.assignedRider.phoneNumber}`}
                    style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'var(--accent)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 18, textDecoration: 'none', flexShrink: 0,
                    }}
                    onClick={e => e.stopPropagation()}
                  >📞</a>
                )}
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Rider assigned
                {order.riderAcceptedAt && <span> · {new Date(order.riderAcceptedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            )}
          </div>
        )}

        {/* Mark Ready — shown any time order is PLACED and sender hasn't marked ready yet */}
        {canMarkReady && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)', borderColor: 'var(--accent)', borderWidth: 1.5 }}>
            <div className="title-sm" style={{ marginBottom: 4 }}>
              {order.assignedRiderId ? '🛵 Rider is on the way!' : '📦 Pack Your Order'}
            </div>
            <div className="body-xs" style={{ marginBottom: 'var(--sp-12)', lineHeight: 1.5 }}>
              {order.assignedRiderId
                ? 'Your rider has accepted the order. Pack your package and confirm it is ready for pickup.'
                : 'Pack your package and mark it ready. We will notify the rider as soon as one is assigned.'}
            </div>
            <button
              className="btn btn-primary btn-full"
              disabled={markingReady}
              onClick={handleMarkReady}
            >
              {markingReady
                ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} /> Marking Ready…</>
                : '📦 Mark Package as Ready'}
            </button>
          </div>
        )}

        {/* Drop OTP — shown to receiver when order is DISPATCHED (Fix 3) */}
        {showDropOtp && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)', borderColor: 'var(--blue, #4F6EF7)', borderWidth: 1.5 }}>
            <div className="title-sm" style={{ marginBottom: 4 }}>📬 Your Delivery OTP</div>
            <div className="body-xs" style={{ marginBottom: 'var(--sp-12)', lineHeight: 1.5 }}>
              Your package is on its way! Give this OTP to the rider when they arrive to confirm delivery.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-12)', marginBottom: 'var(--sp-8)' }}>
              <div className="mono" style={{ fontSize: 36, fontWeight: 800, letterSpacing: 10, color: 'var(--accent)' }}>
                {order.dropOtp}
              </div>
              <button className="btn btn-ghost btn-icon-sm" onClick={() => { navigator.clipboard.writeText(order.dropOtp); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <CheckCircle size={15} style={{ color: 'var(--green)' }} /> : <Copy size={15} />}
              </button>
            </div>
            <div className="body-xs" style={{ color: 'var(--text-tertiary)' }}>
              ⚠️ Only share this OTP with the rider delivering your package.
            </div>
          </div>
        )}

        {/* Pickup OTP — rider tells sender the OTP, sender types it here to confirm handover */}
        {canHandover && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)', borderColor: 'var(--accent)', borderWidth: 1.5 }}>
            <div className="title-sm" style={{ marginBottom: 4 }}>🛵 Rider is here!</div>
            <div className="body-xs" style={{ marginBottom: 'var(--sp-12)', lineHeight: 1.5 }}>
              Ask the rider for the <strong>Pickup OTP</strong> and enter it below to confirm handover.
            </div>
            <div className="row gap-8">
              <input
                className="input"
                placeholder="Enter OTP from rider"
                value={pickupOtp}
                onChange={e => setPickupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', fontSize: 22, textAlign: 'center' }}
              />
              <button className="btn btn-primary" disabled={handingOver || pickupOtp.length < 4} onClick={handover}>
                {handingOver
                  ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} />
                  : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* Route */}
        <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-12)' }}>Route</div>
          <RouteMap pickupLat={pickupLat} pickupLng={pickupLng} dropLat={dropLat} dropLng={dropLng} riderLat={riderLat} riderLng={riderLng} status={order.status} />
          {/* Address */}
          <div style={{ marginTop: 'var(--sp-14)', display: 'flex', gap: 'var(--sp-12)' }}>
            <div className="col gap-4" style={{ alignItems: 'center', paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
              <div style={{ width: 2, flex: 1, minHeight: 32, background: 'var(--border-md)' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
            </div>
            <div className="col flex-1" style={{ gap: 'var(--sp-16)' }}>
              <div>
                <div className="body-sm font-semibold">{order.senderNode?.contactPerson || 'Pickup'}</div>
                <div className="body-xs" style={{ marginTop: 2, lineHeight: 1.4 }}>{addrStr(order.senderNode)}</div>
                {order.senderNode?.contactNumber && <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{order.senderNode.contactNumber}</div>}
              </div>
              <div>
                <div className="body-sm font-semibold">{order.receiverNode?.contactPerson || 'Drop'}</div>
                <div className="body-xs" style={{ marginTop: 2, lineHeight: 1.4 }}>{addrStr(order.receiverNode)}</div>
                {order.receiverNode?.contactNumber && <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{order.receiverNode.contactNumber}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        {order.items?.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
            <div className="label-sm" style={{ marginBottom: 'var(--sp-12)' }}>Items ({order.items.length})</div>
            {order.items.map((item, i) => (
              <div key={i} className="summary-row">
                <div>
                  <div className="body-sm font-semibold">{item.name || item.itemName}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.type} · {item.size} · {item.category}</div>
                </div>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {/* Billing */}
        {order.billing && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)' }}>
            <div className="label-sm" style={{ marginBottom: 'var(--sp-12)' }}>Billing</div>
            <div className="summary-row">
              <span className="key">Delivery</span>
              <span className="val mono">₹{Number(order.billing.deliveryCharges || 0).toFixed(2)}</span>
            </div>
            {order.billing.handlingCharges > 0 && (
              <div className="summary-row">
                <span className="key">Handling</span>
                <span className="val mono">₹{Number(order.billing.handlingCharges).toFixed(2)}</span>
              </div>
            )}
            {order.billing.gstCharges > 0 && (
              <div className="summary-row">
                <span className="key">GST ({order.billing.gstPercentage}%)</span>
                <span className="val mono">₹{Number(order.billing.gstCharges).toFixed(2)}</span>
              </div>
            )}
            {order.billing.discountAmount > 0 && (
              <div className="summary-row">
                <span className="key">Discount</span>
                <span className="val mono" style={{ color: 'var(--green)' }}>-₹{Number(order.billing.discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="summary-row summary-total">
              <span className="key">Total Payable</span>
              <span className="val">₹{Number(order.billing.payableAmount || order.billing.subtotalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 'var(--sp-6)' }}>
              {order.billing.paymentMode || 'COD'} · {order.billing.totalDistance ? `${Number(order.billing.totalDistance).toFixed(1)} km` : ''}
            </div>
          </div>
        )}

        {/* ── COD Digital Payment Card ── */}
        {order.billing?.paymentMode === 'COD' && !['CANCELLED'].includes(order.status) && (
          <div className="card" style={{
            marginBottom: 'var(--sp-12)',
            borderColor: codPayment?.paymentStatus === 'PAID' ? 'rgba(22,163,74,0.35)' : 'rgba(245,158,11,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-12)' }}>
              <Banknote size={16} style={{ color: codPayment?.paymentStatus === 'PAID' ? 'var(--green)' : 'var(--orange)' }} />
              <div className="label-sm" style={{ margin: 0 }}>
                {codPayment?.paymentStatus === 'PAID' ? 'Payment Received ✅' : 'Cash on Delivery — Pay Digitally'}
              </div>
              {codLoading && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, marginLeft: 'auto' }} />}
            </div>

            {codPayment?.paymentStatus === 'PAID' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Payment Confirmed</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    ₹{Number(codPayment?.amount || order.billing?.payableAmount || 0).toFixed(2)} received
                    {codPayment?.paymentAt ? ` · ${new Date(codPayment.paymentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--sp-12)', lineHeight: 1.5 }}>
                  You selected Cash on Delivery. You can also pay digitally via UPI — scan the QR below or tap Pay Now.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                  borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-12)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Amount to Pay</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18 }}>
                    ₹{Number(codPayment?.amount || order.billing?.payableAmount || 0).toFixed(2)}
                  </span>
                </div>

                {codPayment?.qrCodeImageUrl && (
                  <div style={{ textAlign: 'center', marginBottom: 'var(--sp-12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 'var(--sp-8)' }}>
                      <QrCode size={12} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                        SCAN WITH ANY UPI APP
                      </span>
                    </div>
                    <div style={{ display: 'inline-block', padding: 10, background: '#fff', borderRadius: 12, border: '2px solid var(--border)' }}>
                      <img src={codPayment.qrCodeImageUrl} alt="UPI QR Code"
                        style={{ width: 180, height: 180, display: 'block' }} />
                    </div>
                    {codPayment.qrExpiresAt && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
                        Expires {new Date(codPayment.qrExpiresAt * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-full"
                  disabled={payNowBusy || codLoading || !codPayment?.razorpayOrderId}
                  onClick={handlePayNow}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {payNowBusy
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} /> Processing…</>
                    : <><Smartphone size={15} /> Pay Now via UPI / Card</>}
                </button>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Secured by Razorpay · You can also pay cash at delivery
                </div>
              </>
            )}
          </div>
        )}

        {/* Refund Section — shown for cancelled online-payment orders that were actually placed */}
        {order.status === 'CANCELLED' && order.billing?.paymentMode !== 'COD' && !!order.placedAt && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)', borderColor: refund?.status === 'REFUNDED' ? 'rgba(22,163,74,0.3)' : refund?.status === 'SKIPPED' ? 'rgba(220,38,38,0.2)' : 'rgba(251,146,60,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-10)' }}>
              <CreditCard size={16} color={refund?.status === 'REFUNDED' ? 'var(--green)' : refund?.status === 'SKIPPED' ? 'var(--red)' : 'var(--orange)'} />
              <div className="label-sm" style={{ margin: 0 }}>Refund</div>
              {refundLoading && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
            </div>

            {!refund && !refundLoading && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                ⏳ Refund request is being created. Please check back shortly.
              </div>
            )}

            {refund && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-10)' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    color: refund.status === 'REFUNDED' ? 'var(--green)' : refund.status === 'SKIPPED' ? 'var(--red)' : 'var(--orange)',
                    background: refund.status === 'REFUNDED' ? 'var(--green-dim)' : refund.status === 'SKIPPED' ? 'var(--red-dim)' : 'var(--orange-dim)',
                  }}>
                    {refund.status === 'REFUNDED' ? '✓ Refunded' : refund.status === 'SKIPPED' ? 'Not Applicable' : '⏳ Pending'}
                  </span>
                </div>

                <div className="summary-row">
                  <span className="key">Amount Paid</span>
                  <span className="val mono">₹{Number(refund.originalAmount || 0).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span className="key">Cancellation Fee</span>
                  <span className="val mono" style={{ color: 'var(--red)' }}>−₹{Number(refund.deductedAmount || 0).toFixed(2)}</span>
                </div>
                <div className="summary-row summary-total">
                  <span className="key">Refund Amount</span>
                  <span className="val" style={{ color: refund.status === 'REFUNDED' ? 'var(--green)' : 'inherit' }}>
                    ₹{Number(refund.refundAmount || 0).toFixed(2)}
                  </span>
                </div>

                {refund.status === 'PENDING' && (
                  <div style={{ marginTop: 'var(--sp-10)', padding: '10px 12px', background: 'color-mix(in srgb, var(--orange) 10%, transparent)', borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: 1.5 }}>
                    Our team will process your refund shortly. You'll receive a notification when it's done.
                  </div>
                )}
                {refund.status === 'REFUNDED' && (
                  <div style={{ marginTop: 'var(--sp-10)', padding: '10px 12px', background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: 1.5 }}>
                    ✅ Refund processed{refund.refundedAt ? ` on ${new Date(refund.refundedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}. Allow 3–5 business days to reflect.
                    {refund.refundTransactionRef && <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Ref: {refund.refundTransactionRef}</div>}
                  </div>
                )}
                {refund.status === 'SKIPPED' && (
                  <div style={{ marginTop: 'var(--sp-10)', padding: '10px 12px', background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: 1.5 }}>
                    {refund.refundNotes || 'Refund was not applicable for this order.'}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Cancel */}
        {/* ── Rider Rating Card — shown after delivery ─────────────────────── */}
        {order.status === 'DELIVERED' && order.assignedRiderId && (
          <div className="card" style={{ marginBottom: 'var(--sp-12)', borderColor: ratingDone ? 'rgba(22,163,74,0.3)' : 'rgba(245,158,11,0.35)', borderWidth: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-10)' }}>
              <Star size={16} style={{ color: '#f59e0b' }} />
              <div className="label-sm" style={{ margin: 0 }}>Rate Your Rider</div>
            </div>

            {ratingDone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--green)' }}>Thanks! Your rating has been submitted.</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--sp-10)' }}>
                  How was your experience with{' '}
                  <strong>{[order.assignedRider?.firstName, order.assignedRider?.lastName].filter(Boolean).join(' ') || 'your rider'}</strong>?
                </div>

                {/* Star picker */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-10)' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRatingStars(star)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                        fontSize: 30, lineHeight: 1,
                        color: star <= ratingStars ? '#f59e0b' : 'var(--border)',
                        transition: 'color 0.1s, transform 0.1s',
                        transform: star <= ratingStars ? 'scale(1.15)' : 'scale(1)',
                      }}
                    >★</button>
                  ))}
                </div>
                {ratingStars > 0 && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 'var(--sp-10)', fontWeight: 600 }}>
                    {['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent 🌟'][ratingStars]}
                  </div>
                )}

                {/* Comment */}
                <textarea
                  className="input"
                  placeholder="Add a comment (optional)…"
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  maxLength={500}
                  rows={2}
                  style={{ width: '100%', resize: 'vertical', fontSize: 13, marginBottom: 'var(--sp-10)', boxSizing: 'border-box' }}
                />

                <button
                  className="btn btn-primary btn-full"
                  disabled={ratingSubmitting || !ratingStars}
                  onClick={handleRating}
                >
                  {ratingSubmitting
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} /> Submitting…</>
                    : ratingStars ? `Submit ${ratingStars}★ Rating` : 'Select stars to rate'}
                </button>
              </>
            )}
          </div>
        )}

        {canCancel && !showCancel && (
          <button className="btn btn-danger btn-full" style={{ marginTop: 'var(--sp-8)' }} onClick={() => setShowCancel(true)}>
            Cancel Order
          </button>
        )}
        {showCancel && (
          <div className="card" style={{ marginTop: 'var(--sp-12)', borderColor: 'rgba(220,38,38,0.3)' }}>
            <div className="title-sm" style={{ marginBottom: 'var(--sp-12)', color: 'var(--red)' }}>Cancel Order</div>
            <div className="form-group" style={{ marginBottom: 'var(--sp-12)' }}>
              <label className="form-label">Reason</label>
              <input className="input" placeholder="Why are you cancelling?" value={cancelReason}
                onChange={e => setCancelReason(e.target.value)} />
            </div>
            <div className="row gap-8">
              <button className="btn btn-secondary flex-1" onClick={() => setShowCancel(false)}>Back</button>
              <button className="btn btn-danger flex-1" disabled={cancelling} onClick={cancel}>
                {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}