import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, CreditCard, Wallet, MapPin, Plus,
  Phone, CheckCircle2, AlertCircle, ChevronRight, Edit2, X,
  RefreshCw, Star, Tag, Percent, Loader, ShieldCheck,
  Info, ChevronDown, ChevronUp, Package, Camera, ImagePlus, Trash2,
  User as UserIcon, Lock,
} from 'lucide-react';
import { ordersAPI, paymentsAPI, addressesAPI, offersAPI, filesAPI, profileAPI, itemCatalogAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const FALLBACK_ITEM_TYPES = ['FRAGILE', 'NON_FRAGILE', 'PERISHABLE', 'NON_PERISHABLE', 'ELECTRONICS', 'CLOTHING', 'MEDICAL', 'DOCUMENT', 'FOOD', 'OTHER'];
const FALLBACK_ITEM_CATEGORIES = ['DOCUMENT', 'FOOD', 'GROCERY', 'ELECTRONICS', 'CLOTHING', 'MEDICAL', 'PERISHABLE', 'OTHER'];
const FALLBACK_ITEM_SIZES = [
  { key: 'MINI', name: 'Mini', weightMin: 0, weightMax: 2, dimensions: null },
  { key: 'SMALL', name: 'Small', weightMin: 2, weightMax: 15, dimensions: null },
  { key: 'MEDIUM', name: 'Medium', weightMin: 15, weightMax: 30, dimensions: null },
  { key: 'LARGE', name: 'Large', weightMin: 30, weightMax: 60, dimensions: null },
  { key: 'EXTRA_LARGE', name: 'Extra Large', weightMin: 60, weightMax: 120, dimensions: null },
];

const STEPS = [
  { label: 'Sender', icon: '🙋' },
  { label: 'Receiver', icon: '👤' },
  { label: 'Pickup', icon: '📍' },
  { label: 'Drop', icon: '🏁' },
  { label: 'Items', icon: '📦' },
  { label: 'Payment', icon: '💳' },
  { label: 'Confirm', icon: '✅' },
];

const EMPTY_ADDR = {
  street: '', city: '', state: '', postalCode: '', country: 'India',
  area: '', buildingOrFlat: '', contactNumber: '', contactPerson: '',
  latitude: null, longitude: null,
};

import ReactDOM from 'react-dom';

/* ─── MapModal — Portal component ────────────────────────────────────────────
   Rendered directly into document.body via createPortal.
   This escapes ALL parent CSS: overflow:hidden, transforms, Razorpay iframes,
   stacking contexts — nothing can clip or overflow this modal.

   Google Maps REQUIRES an explicit pixel height on its container div.
   We measure the real viewport height with useEffect (not window.innerHeight
   at render time, which can be stale/wrong on mobile).
────────────────────────────────────────────────────────────────────────────── */
const MODAL_HEADER_H = 58;
const MODAL_SEARCH_H = 54;
const MODAL_FOOTER_H = 56;

const MapModal = memo(function MapModal({
  mapRef, mapCenter, searchQuery, suggestions, showSuggestions,
  searchLoading, geocoding, onClose, onSearchInput, onSelectSuggestion,
  onClearSearch, onConfirm,
}) {
  const [vpHeight, setVpHeight] = useState(0);

  // Measure REAL viewport height after mount — reliable on all devices
  useEffect(() => {
    const measure = () => setVpHeight(window.visualViewport?.height ?? window.innerHeight);
    measure();
    window.visualViewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    // Lock body scroll while map is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.visualViewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
      document.body.style.overflow = prev;
    };
  }, []);

  // Don't render until we have a real height
  if (!vpHeight) return null;

  const sheetH = Math.min(Math.floor(vpHeight * 0.90), 620);
  const mapH = Math.max(sheetH - MODAL_HEADER_H - MODAL_SEARCH_H - MODAL_FOOTER_H, 160);

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        // Hard clip — nothing escapes
        overflow: 'hidden',
        // Force a new stacking context so Razorpay/other fixed elements stay below
        isolation: 'isolate',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          height: sheetH,               // ← exact pixel height
          background: 'var(--bg-surface)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',            // ← hard clip children including Maps
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          height: MODAL_HEADER_H, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              📍 Pick Location on Map
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              Drag the pin or tap to set location
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Search Bar ── */}
        <div style={{ height: MODAL_SEARCH_H, flexShrink: 0, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', border: '1.5px solid var(--border-md)', borderRadius: 10, padding: '7px 12px', width: '100%' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Search for a place…"
              value={searchQuery}
              onChange={e => onSearchInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && onSearchInput(searchQuery)}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text-primary)', minWidth: 0 }}
              autoComplete="off"
            />
            {searchLoading && <div className="loader-sm" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />}
            {searchQuery && !searchLoading && (
              <button onClick={onClearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)' }}>
                <X size={13} />
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: 'absolute', left: 12, right: 12, top: MODAL_SEARCH_H + 2, background: 'var(--bg-surface)', border: '1px solid var(--border-md)', borderRadius: 10, overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxHeight: 180, overflowY: 'auto' }}>
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  onClick={() => onSelectSuggestion(s.place_id, s.description)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <svg style={{ marginTop: 1, flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3 }}>
                      {s.structured_formatting?.main_text || s.description}
                    </div>
                    {s.structured_formatting?.secondary_text && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3 }}>
                        {s.structured_formatting.secondary_text}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Map — exact pixel height, Google Maps renders reliably ── */}
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: mapH,      // ← exact px, never 0, never overflow
            flexShrink: 0,
            background: 'var(--bg-elevated)',
            overflow: 'hidden',
          }}
        />

        {/* ── Footer ── */}
        <div style={{
          height: MODAL_FOOTER_H, flexShrink: 0,
          padding: '0 16px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: mapCenter ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 11 }}>
            {mapCenter
              ? `${mapCenter.lat.toFixed(5)}, ${mapCenter.lng.toFixed(5)}`
              : 'Tap map to set location'}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={onConfirm}
            disabled={geocoding || !mapCenter}
            style={{ minWidth: 136 }}
          >
            {geocoding
              ? <><div className="loader-sm" style={{ borderTopColor: '#fff', width: 11, height: 11, borderWidth: 2 }} /> Filling…</>
              : <><Check size={12} /> Confirm Location</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body   // ← renders outside ALL React tree parents
  );
});


const SIZE_COLOR = {
  MINI: '#64748b', SMALL: '#0ea5e9', MEDIUM: '#8b5cf6',
  LARGE: '#f59e0b', EXTRA_LARGE: '#ef4444',
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10) return '+91' + d;
  if (d.length === 11 && d.startsWith('0')) return '+91' + d.slice(1);
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  return null;
}

function addrSummary(a) {
  return [a?.buildingOrFlat, a?.street, a?.area, a?.city].filter(Boolean).join(', ');
}

function addrFromPersisted(p) {
  if (!p) return null;
  return {
    street: p.street || '', city: p.city || '', state: p.state || '',
    postalCode: p.postalCode || '', country: p.country || 'India',
    area: p.area || '', buildingOrFlat: p.buildingOrFlat || '',
    contactNumber: p.contactNumber || '', contactPerson: p.contactPerson || '',
    latitude: p.latitude || null, longitude: p.longitude || null,
  };
}

function addrFromSaved(a) {
  return {
    street: a.street || '', city: a.city || '', state: a.state || '',
    postalCode: a.postalCode || '', country: a.country || 'India',
    area: a.area || '', buildingOrFlat: a.buildingOrFlat || '',
    contactNumber: a.contactNumber || '', contactPerson: a.contactPerson || '',
    latitude: a.latitude || null, longitude: a.longitude || null,
  };
}

function sanitizeAddr(addr) {
  return { ...addr, latitude: Number(addr.latitude) || 0, longitude: Number(addr.longitude) || 0 };
}

function extractApiError(e) {
  const data = e.response?.data;
  if (!data) return e.message || 'Something went wrong';
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  if (data.error) return data.error;
  if (Array.isArray(data.errors)) return data.errors.map(x => x.msg || `${x.path}: ${x.msg}`).join(' · ');
  return 'Request failed';
}

function getCatalogKey(entry) {
  return typeof entry === 'string' ? entry : entry?.key ?? '';
}

function getCatalogName(entry) {
  return typeof entry === 'string' ? entry : entry?.name ?? entry?.key ?? '';
}

/* ─── Step Bar ────────────────────────────────────────────────────────────── */
const StepBar = memo(function StepBar({ step, itemCount }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 12px',
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      overflowX: 'auto', gap: 0, scrollbarWidth: 'none',
    }}>
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={s.label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--bg-overlay)',
                color: (done || active) ? '#fff' : 'var(--text-tertiary)',
                fontWeight: 700, transition: 'all 0.25s',
                boxShadow: active ? '0 0 0 3px var(--accent-ring)' : 'none',
                fontSize: done ? 12 : 11,
              }}>
                {done ? <Check size={12} strokeWidth={3} /> : <span>{s.icon}</span>}
              </div>
              {/* Item count badge on Items step */}
              {i === 4 && itemCount > 0 && !done && (
                <div style={{
                  position: 'absolute', top: -4, right: -6,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 8, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--bg-surface)',
                }}>
                  {itemCount > 9 ? '9+' : itemCount}
                </div>
              )}
              <span style={{
                fontSize: 9, fontWeight: active ? 700 : 500,
                color: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 8, maxWidth: 24,
                background: done ? 'var(--green)' : 'var(--border-md)',
                borderRadius: 1, margin: '0 3px', marginBottom: 14,
                transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

/* ─── Section Head ────────────────────────────────────────────────────────── */
const SectionHead = memo(function SectionHead({ emoji, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: 'var(--accent-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>{emoji}</div>
      <div>
        <div className="label-sm">{title}</div>
        {sub && <div className="body-xs" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
});

/* ─── Fade-In Error Banner ────────────────────────────────────────────────── */
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      className="alert alert-error"
      style={{
        marginTop: 12, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 8,
        animation: 'fadeSlideIn 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit', flexShrink: 0 }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ─── Address Tile ────────────────────────────────────────────────────────── */
const AddrTile = memo(function AddrTile({ label, addr, dotColor, onEdit }) {
  const summary = addrSummary(addr);
  const isEmpty = !summary;
  return (
    <div
      onClick={onEdit}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
        padding: '12px 14px',
        background: isEmpty ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: `1.5px solid ${isEmpty ? 'var(--border-md)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', transition: 'all var(--dur)',
      }}
    >
      <div style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
        background: isEmpty ? 'var(--border-md)' : dotColor,
        boxShadow: isEmpty ? 'none' : `0 0 0 3px ${dotColor}22`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 4,
        }}>{label}</div>
        {isEmpty
          ? <div className="body-sm" style={{ color: 'var(--text-tertiary)' }}>Tap to set…</div>
          : <>
            {addr.contactPerson && <div className="body-sm font-semibold">{addr.contactPerson}</div>}
            <div className="body-xs" style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{summary}</div>
            {addr.contactNumber && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                {addr.contactNumber}
              </div>
            )}
            {(!addr.latitude || !addr.longitude) && (
              <div style={{ fontSize: 10, color: 'var(--orange)', marginTop: 4, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={10} /> Coordinates missing — edit to add lat/lng
              </div>
            )}
          </>
        }
      </div>
      <div style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--bg-overlay)', flexShrink: 0 }}>
        <Edit2 size={11} style={{ color: 'var(--text-tertiary)', display: 'block' }} />
      </div>
    </div>
  );
});

/* ─── Address Sheet ───────────────────────────────────────────────────────── */
const AddressSheet = memo(function AddressSheet({ title, savedAddresses, onPick, onManual, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="title-sm">{title}</span>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ overflowY: 'auto', paddingBottom: 16 }}>
          {savedAddresses.length > 0 && (
            <>
              <div className="label-xs" style={{ padding: '12px 16px 6px' }}>YOUR SAVED ADDRESSES</div>
              {savedAddresses.map(a => (
                <div key={a.id} className="list-item" onClick={() => onPick(a)}>
                  <div className="list-icon" style={{ background: 'var(--accent-dim)' }}>
                    <MapPin size={15} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="list-body">
                    <div className="list-title">
                      {a.label || a.contactPerson || a.area || a.city}
                      {a.isPreferredPickup && (
                        <span style={{ marginLeft: 5, fontSize: 9, background: 'var(--green-dim)', color: 'var(--green)', borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>PICKUP</span>
                      )}
                      {a.isPreferredDrop && (
                        <span style={{ marginLeft: 5, fontSize: 9, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>DROP</span>
                      )}
                    </div>
                    <div className="list-subtitle truncate">{addrSummary(a)}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              ))}
            </>
          )}
          <div className="list-item" style={{ marginTop: 4 }} onClick={onManual}>
            <div className="list-icon" style={{ background: 'var(--bg-overlay)' }}>
              <Plus size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="list-body">
              <div className="list-title">Enter address manually</div>
              <div className="list-subtitle">Type in the full address</div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Address Form ────────────────────────────────────────────────────────── */
// FIX: Memoized + stable onChange reference to prevent re-render cascade
const AddrForm = memo(function AddrForm({ addr, onChange, savedAddresses, onPickSaved, onSavePrompt }) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapObjRef = useRef(null);
  const searchDebounce = useRef(null);
  const sessionTokenRef = useRef(null);
  const onChangeRef = useRef(onChange);

  // FIX: Keep onChange ref up to date to avoid stale closures
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const GMAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const FULL = [
    { key: 'area', label: 'Area / Locality', ph: 'Andheri West' },
    { key: 'buildingOrFlat', label: 'Building / Flat', ph: 'A-204, Sunrise Apt' },
    { key: 'street', label: 'Street *', ph: 'Link Road' },
  ];
  const HALF = [
    { key: 'city', label: 'City *', ph: 'Mumbai' },
    { key: 'state', label: 'State', ph: 'Maharashtra' },
    { key: 'postalCode', label: 'PIN Code', ph: '400053' },
    { key: 'contactPerson', label: 'Contact Person', ph: 'John Doe' },
    { key: 'contactNumber', label: 'Contact Number', ph: '+91XXXXXXXXXX' },
  ];

  // Helper: extract address component by type(s)
  const getComp = useCallback((comps, ...types) => {
    for (const type of types) {
      const c = comps.find(c => c.types.includes(type));
      if (c) return c.long_name;
    }
    return '';
  }, []);

  // Helper: reverse geocode lat/lng → address fields, then call onChangeRef
  const reverseGeocode = useCallback((lat, lng) => {
    if (!window.google?.maps) {
      // Google Maps not loaded — just set coords, no address fill
      onChangeRef.current(prev => ({ ...prev, latitude: lat, longitude: lng }));
      setGpsLoading(false);
      return;
    }
    // Keep gpsLoading true, additionally show geocoding sub-state
    setGeocoding(true);
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      setGeocoding(false);
      setGpsLoading(false);
      let filled = { latitude: lat, longitude: lng };
      if (status === 'OK' && results?.length) {
        const best = results.find(r =>
          r.types.includes('street_address') || r.types.includes('route') || r.types.includes('premise')
        ) || results[0];
        const comps = best.address_components;
        const streetNum = getComp(comps, 'street_number');
        const route = getComp(comps, 'route');
        const sublocality = getComp(comps, 'sublocality_level_1', 'sublocality', 'neighborhood');
        const locality = getComp(comps, 'locality');
        const adminL2 = getComp(comps, 'administrative_area_level_2');
        const adminL1 = getComp(comps, 'administrative_area_level_1');
        const postal = getComp(comps, 'postal_code');
        filled = {
          ...filled,
          street: [streetNum, route].filter(Boolean).join(' '),
          area: sublocality,
          city: locality || adminL2,
          state: adminL1,
          postalCode: postal,
        };
      }
      onChangeRef.current(prev => {
        const merged = { ...prev, ...filled };
        // Don't overwrite existing non-empty user-typed fields with blank geocode result
        Object.keys(filled).forEach(k => { if (!filled[k] && prev[k]) merged[k] = prev[k]; });
        return merged;
      });
    });
  }, [getComp]);

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('GPS not supported on this device'); return; }
    setGpsLoading(true); setGpsError('');

    // Ensure Google Maps script is loaded for reverse geocoding
    const doGPS = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          reverseGeocode(lat, lng);
        },
        (err) => {
          setGpsError(
            err.code === 1 ? 'Location permission denied. Please allow in browser settings.' :
              err.code === 2 ? 'Location unavailable. Try again.' :
                'GPS timed out. Try again.'
          );
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    if (window.google?.maps) {
      doGPS();
    } else if (GMAP_KEY) {
      // Load Maps script first, then GPS
      const existing = document.getElementById('gmap-script');
      if (existing) {
        existing.addEventListener('load', doGPS, { once: true });
      } else {
        const s = document.createElement('script');
        s.id = 'gmap-script';
        s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAP_KEY}&libraries=places`;
        s.async = true;
        s.onload = doGPS;
        document.head.appendChild(s);
      }
    } else {
      // No Maps key — just set coords without address fill
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          onChangeRef.current(prev => ({ ...prev, latitude: lat, longitude: lng }));
          setGpsLoading(false);
        },
        (err) => {
          setGpsError(
            err.code === 1 ? 'Location permission denied.' :
              err.code === 2 ? 'Location unavailable.' : 'GPS timed out.'
          );
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [GMAP_KEY, reverseGeocode]);

  const handleOpenMap = useCallback(() => {
    if (!GMAP_KEY) {
      setGpsError('Google Maps API key not configured. Please use GPS or enter coordinates manually.');
      return;
    }
    setShowMap(true);
  }, [GMAP_KEY]);

  useEffect(() => {
    if (!showMap) return;
    // MapModal renders via portal — give React one tick to mount the DOM node
    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      const initLat = addr.latitude || 19.0760;
      const initLng = addr.longitude || 72.8777;

      function initMap(maps) {
        const center = { lat: initLat, lng: initLng };
        const map = new maps.Map(mapRef.current, {
          center, zoom: 16, disableDefaultUI: true, zoomControl: true,
          styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
        });
        mapObjRef.current = map;
        const marker = new maps.Marker({
          position: center, map, draggable: true,
          icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: 'var(--accent,#1EC674)', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        });
        markerRef.current = marker;
        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          setMapCenter({ lat: pos.lat(), lng: pos.lng() });
        });
        map.addListener('click', (e) => {
          marker.setPosition(e.latLng);
          setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        // CRITICAL: trigger resize so Maps renders correctly inside our fixed-height container
        // Without this, the map tiles render grey or misaligned
        setTimeout(() => {
          maps.event.trigger(map, 'resize');
          map.setCenter(center);
        }, 100);
      }

      if (window.google?.maps?.places) { initMap(window.google.maps); return; }
      const existing = document.getElementById('gmap-script');
      if (existing) { existing.onload = () => initMap(window.google.maps); return; }
      const s = document.createElement('script');
      s.id = 'gmap-script';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAP_KEY}&libraries=places`;
      s.async = true;
      s.onload = () => initMap(window.google.maps);
      document.head.appendChild(s);
    }, 50); // wait for MapModal portal to mount
    return () => clearTimeout(timer);
  }, [showMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmMap = useCallback(() => {
    if (!mapCenter) { setShowMap(false); return; }
    const lat = parseFloat(mapCenter.lat.toFixed(6));
    const lng = parseFloat(mapCenter.lng.toFixed(6));
    const getComp = (comps, ...types) => {
      for (const type of types) {
        const c = comps.find(c => c.types.includes(type));
        if (c) return c.long_name;
      }
      return '';
    };
    if (window.google?.maps) {
      setGeocoding(true);
      new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        setGeocoding(false);
        let filled = { latitude: lat, longitude: lng };
        if (status === 'OK' && results?.length) {
          const best = results.find(r =>
            r.types.includes('street_address') || r.types.includes('route') || r.types.includes('premise')
          ) || results[0];
          const comps = best.address_components;
          const streetNum = getComp(comps, 'street_number');
          const route = getComp(comps, 'route');
          const sublocality = getComp(comps, 'sublocality_level_1', 'sublocality', 'neighborhood');
          const locality = getComp(comps, 'locality');
          const adminL2 = getComp(comps, 'administrative_area_level_2');
          const adminL1 = getComp(comps, 'administrative_area_level_1');
          const postal = getComp(comps, 'postal_code');
          filled = {
            ...filled,
            street: [streetNum, route].filter(Boolean).join(' '),
            area: sublocality,
            city: locality || adminL2,
            state: adminL1,
            postalCode: postal,
          };
        }
        onChangeRef.current(prev => {
          const merged = { ...prev, ...filled };
          // Only overwrite non-empty fields from geocode
          Object.keys(filled).forEach(k => { if (!filled[k] && prev[k]) merged[k] = prev[k]; });
          return merged;
        });
        setShowMap(false); setSearchQuery(''); setSuggestions([]);
      });
    } else {
      onChangeRef.current(prev => ({ ...prev, latitude: lat, longitude: lng }));
      setShowMap(false); setSearchQuery(''); setSuggestions([]);
    }
  }, [mapCenter]);

  const handleSearchInput = useCallback((val) => {
    setSearchQuery(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!val.trim() || val.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    searchDebounce.current = setTimeout(() => {
      if (!window.google?.maps?.places) return;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      setSearchLoading(true);
      new window.google.maps.places.AutocompleteService().getPlacePredictions(
        { input: val, sessionToken: sessionTokenRef.current },
        (predictions, status) => {
          setSearchLoading(false);
          const OK = window.google.maps.places.PlacesServiceStatus.OK;
          if (status === OK && predictions?.length) {
            setSuggestions(predictions); setShowSuggestions(true);
          } else {
            setSuggestions([]); setShowSuggestions(false);
          }
        }
      );
    }, 350);
  }, []);

  const handleSelectSuggestion = useCallback((placeId, description) => {
    setSearchQuery(description); setShowSuggestions(false); setSuggestions([]);
    sessionTokenRef.current = null;
    if (!window.google?.maps) return;
    new window.google.maps.Geocoder().geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        const newCenter = { lat: loc.lat(), lng: loc.lng() };
        setMapCenter(newCenter);
        if (mapObjRef.current) { mapObjRef.current.setCenter(newCenter); mapObjRef.current.setZoom(17); }
        if (markerRef.current) markerRef.current.setPosition(newCenter);
      }
    });
  }, []);

  const hasCoords = addr.latitude && addr.longitude;

  // NEW: inline field validation helper
  const fieldError = useCallback((key, val) => {
    if (key === 'street' && val !== undefined && val.trim().length > 0 && val.trim().length < 3) return 'Too short';
    if (key === 'postalCode' && val && !/^\d{6}$/.test(val)) return '6-digit PIN required';
    if (key === 'contactNumber' && val && !/^(\+91)?\d{10}$/.test(val.replace(/\s/g, ''))) return 'Invalid number';
    return null;
  }, []);

  return (
    <div className="col gap-10">
      {savedAddresses?.length > 0 && (
        <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onPickSaved}>
          <Star size={13} /> Pick from saved
        </button>
      )}

      {/* Coordinates section */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: `1.5px solid ${hasCoords ? 'rgba(30,198,116,0.35)' : 'var(--border-md)'}`,
        borderRadius: 'var(--radius-sm)', padding: '12px 14px',
        transition: 'border-color 0.25s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: hasCoords ? 'var(--accent)' : 'var(--text-tertiary)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <MapPin size={12} /> Location Coordinates {hasCoords ? '✓' : '(Required)'}
          </div>
          {hasCoords && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              {Number(addr.latitude).toFixed(5)}, {Number(addr.longitude).toFixed(5)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: gpsError ? 8 : 0 }}>
          <button
            type="button" className="btn btn-primary"
            style={{ flex: 1, height: 40, fontSize: 12, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={handleGPS} disabled={gpsLoading}
          >
            {gpsLoading
              ? <><div className="loader-sm" style={{ borderTopColor: '#fff' }} /> {geocoding ? 'Filling…' : 'Detecting…'}</>
              : <><MapPin size={13} /> Use My Location</>
            }
          </button>
          <button
            type="button" className="btn btn-secondary"
            style={{ flex: 1, height: 40, fontSize: 12, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={handleOpenMap}
          >
            🗺 Pick on Map
          </button>
        </div>
        {gpsError && (
          <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <AlertCircle size={12} /> {gpsError}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          {[{ key: 'latitude', ph: '19.0760' }, { key: 'longitude', ph: '72.8777' }].map(({ key, ph }) => (
            <div key={key}>
              <label className="form-label" style={{ textTransform: 'capitalize' }}>{key}</label>
              <input
                className="input" type="number" step="0.000001" placeholder={ph}
                value={addr[key] ?? ''}
                onChange={e => onChange({ ...addr, [key]: e.target.value === '' ? null : +e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Address fields with inline validation */}
      {FULL.map(({ key, label, ph }) => {
        const err = fieldError(key, addr[key]);
        return (
          <div key={key} className="form-group">
            <label className="form-label">{label}</label>
            <input
              className="input" placeholder={ph} value={addr[key] || ''}
              onChange={e => onChange({ ...addr, [key]: e.target.value })}
              style={err ? { borderColor: 'var(--red)' } : {}}
            />
            {err && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>{err}</div>}
          </div>
        );
      })}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {HALF.map(({ key, label, ph }) => {
          const err = fieldError(key, addr[key]);
          return (
            <div key={key} className="form-group">
              <label className="form-label">{label}</label>
              <input
                className="input" placeholder={ph} value={addr[key] || ''}
                onChange={e => onChange({ ...addr, [key]: e.target.value })}
                style={err ? { borderColor: 'var(--red)' } : {}}
              />
              {err && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>{err}</div>}
            </div>
          );
        })}
      </div>

      {/* NEW: Save address prompt if manually filled */}
      {onSavePrompt && addr.street && addr.city && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start', color: 'var(--accent)', border: '1px solid var(--accent-ring)' }}
          onClick={onSavePrompt}
        >
          <Star size={12} /> Save this address
        </button>
      )}

      {/* Map Picker Modal — rendered via Portal to document.body so no parent
          CSS (overflow, transform, Razorpay iframe, etc.) can clip or overflow it.
          Google Maps needs an explicit pixel height; we measure it from the actual
          viewport height AFTER the component mounts using a state variable.        */}
      {showMap && <MapModal
        mapRef={mapRef}
        mapCenter={mapCenter}
        searchQuery={searchQuery}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        searchLoading={searchLoading}
        geocoding={geocoding}
        onClose={() => { setShowMap(false); setSearchQuery(''); setSuggestions([]); }}
        onSearchInput={handleSearchInput}
        onSelectSuggestion={handleSelectSuggestion}
        onClearSearch={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}
        onConfirm={confirmMap}
      />}
    </div>
  );
});

/* ─── Bill Card ───────────────────────────────────────────────────────────── */
const BillCard = memo(function BillCard({ billing: b, offerApplied }) {
  if (!b) return null;
  const rows = [
    { label: 'Delivery', val: `₹${Number(b.deliveryCharges).toFixed(2)}`, note: `${Number(b.totalDistance || 0).toFixed(1)} km` },
    { label: 'Platform Fee', val: `₹${Number(b.platformFee || 0).toFixed(2)}` },
    { label: 'Handling', val: `₹${Number(b.handlingCharges || 0).toFixed(2)}` },
    { label: 'Subtotal', val: `₹${Number(b.subtotalAmount).toFixed(2)}` },
    { label: `GST ${Number(b.gstPercentage || 0)}%`, val: `₹${Number(b.gstCharges || 0).toFixed(2)}` },
    ...(b.discountAmount > 0 ? [{
      label: offerApplied ? offerApplied.code : 'Discount',
      val: `-₹${Number(b.discountAmount).toFixed(2)}`, green: true,
      note: offerApplied?.type === 'PERCENTAGE'
        ? `${offerApplied.value}% off${offerApplied.maxDiscount > 0 ? `, max ₹${offerApplied.maxDiscount}` : ''}`
        : `Flat ₹${offerApplied?.value} off`,
    }] : []),
  ];
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: 'var(--bg-overlay)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>BILL SUMMARY</span>
      </div>
      <div style={{ padding: '6px 14px', background: 'var(--bg-surface)' }}>
        {rows.map(({ label, val, green, note }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span className="body-xs" style={{ color: green ? 'var(--green)' : 'var(--text-secondary)' }}>{label}</span>
              {note && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{note}</div>}
            </div>
            <span className="body-xs font-semibold" style={{ color: green ? 'var(--green)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{val}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', background: 'var(--accent-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="body-sm font-semibold">Total Payable</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          ₹{Number(b.payableAmount).toFixed(2)}
        </span>
      </div>
    </div>
  );
});

/* ─── Item Card ──────────────────────────────────────────────────────────── */
// FIX: Memoized — only re-renders when its own item changes
const ItemCard = memo(function ItemCard({
  item, idx, expanded, onToggle, onChange, onDelete, canDelete,
  uploadingImg, onUpload, onRemoveImage,
  catalogSizes, catalogTypes, catalogCategories,
}) {
  const hasName = !!item.name.trim();
  const sizeColor = SIZE_COLOR[item.size] || 'var(--accent)';

  const sizeObj = useMemo(
    () => catalogSizes.find(s => getCatalogKey(s) === item.size),
    [catalogSizes, item.size]
  );

  return (
    <div style={{
      border: `1.5px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
      overflow: 'hidden', transition: 'border-color 0.2s', marginBottom: 10,
    }}>
      {/* Summary row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', cursor: 'pointer',
          background: expanded ? 'var(--accent-dim)' : 'var(--bg-surface)',
          transition: 'background 0.2s', userSelect: 'none',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: expanded ? 'var(--accent)' : 'var(--bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}>
          {hasName && !expanded
            ? <Check size={12} strokeWidth={3} style={{ color: 'var(--green)' }} />
            : <Package size={12} style={{ color: expanded ? '#fff' : 'var(--text-tertiary)' }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="body-sm font-semibold">{item.name}</span>
              {item.quantity > 1 && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)' }}>×{item.quantity}</span>
              )}
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: sizeColor + '18', color: sizeColor, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                {item.size}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-overlay)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {item.category}
              </span>
              {(item.images || []).length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Camera size={9} /> {item.images.length}
                </span>
              )}
            </div>
          ) : (
            <span className="body-sm" style={{ color: 'var(--text-tertiary)' }}>Item {idx + 1} — fill in details</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', padding: 0 }}
            >
              <Trash2 size={13} />
            </button>
          )}
          <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={{ padding: '14px 14px 16px', borderTop: '1px solid var(--border)' }}>
          <div className="col gap-10">
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input
                className="input" placeholder="e.g. Documents"
                value={item.name}
                onChange={e => onChange({ ...item, name: e.target.value })}
                // FIX: auto-focus when item card opens
                autoFocus
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'quantity', label: 'Quantity', type: 'number', min: 1 },
                { key: 'size', label: 'Size', type: 'select', opts: catalogSizes },
                { key: 'type', label: 'Type', type: 'select', opts: catalogTypes },
                { key: 'category', label: 'Category', type: 'select', opts: catalogCategories },
              ].map(({ key, label, type, opts, min }) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  {type === 'select'
                    ? (
                      <select className="input" value={item[key]} onChange={e => onChange({ ...item, [key]: e.target.value })}>
                        {(opts || []).map(o => (
                          <option key={getCatalogKey(o)} value={getCatalogKey(o)}>{getCatalogName(o)}</option>
                        ))}
                      </select>
                    )
                    : <input
                      className="input"
                      type={type}
                      min={min}
                      value={item[key] === 0 ? '' : item[key]}
                      onChange={e => onChange({ ...item, [key]: e.target.value === '' ? '' : +e.target.value })}
                      onFocus={e => e.target.select()}
                      onBlur={e => {
                        const v = +e.target.value;
                        onChange({ ...item, [key]: (!v || v < 1) ? 1 : v });
                      }}
                    />}
                  {key === 'size' && sizeObj && typeof sizeObj !== 'string' && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                      {sizeObj.weightMin} – {sizeObj.weightMax} kg
                      {sizeObj.dimensions ? ` · ${sizeObj.dimensions.width}W×${sizeObj.dimensions.length}L×${sizeObj.dimensions.height}H cm` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Item Images */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Camera size={12} /> Item Photos
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
              </label>
              {(item.images || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {(item.images || []).map((url, imgIdx) => (
                    <div key={imgIdx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)', flexShrink: 0 }}>
                      <img src={url} alt={`item-${idx}-${imgIdx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      <button
                        onClick={() => onRemoveImage(imgIdx)}
                        style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      >
                        <X size={10} style={{ color: '#fff' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '9px 12px', border: '1.5px dashed var(--border-md)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', opacity: uploadingImg ? 0.6 : 1, pointerEvents: uploadingImg ? 'none' : 'auto' }}>
                <input type="file" accept="image/jpeg,image/png,image/jpg" multiple style={{ display: 'none' }} onChange={onUpload} />
                {uploadingImg
                  ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /><span className="body-xs" style={{ color: 'var(--text-secondary)' }}>Uploading…</span></>
                  : <><ImagePlus size={13} style={{ color: 'var(--accent)' }} /><span className="body-xs" style={{ color: 'var(--text-secondary)' }}>Add photos <span style={{ color: 'var(--text-tertiary)' }}>· JPG, PNG · max 10MB each</span></span></>
                }
              </label>
            </div>

            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onToggle}>
              <Check size={12} /> Done editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function PlaceOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* ── Catalog ── */
  const [catalogSizes, setCatalogSizes] = useState(FALLBACK_ITEM_SIZES);
  const [catalogTypes, setCatalogTypes] = useState(FALLBACK_ITEM_TYPES.map(k => ({ key: k, name: k })));
  const [catalogCategories, setCatalogCategories] = useState(FALLBACK_ITEM_CATEGORIES.map(k => ({ key: k, name: k })));
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [step, setStep] = useState(0);

  /* ── Drafts ── */
  const [showDraftScreen, setShowDraftScreen] = useState(false);
  const [draftOrders, setDraftOrders] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [deletingDraftId, setDeletingDraftId] = useState(null);

  /* ── Step 0 – Sender ── */
  const [senderFirstName, setSenderFirstName] = useState('');
  const [senderLastName, setSenderLastName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderLoading, setSenderLoading] = useState(true);

  /* ── Step 1 – Receiver ── */
  const [rawPhone, setRawPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [receiverFound, setReceiverFound] = useState(false);
  const [lookupError, setLookupError] = useState('');

  /* ── Step 2 – Pickup ── */
  const [pickup, setPickup] = useState({ ...EMPTY_ADDR });
  const [pickupSource, setPickupSource] = useState('');
  const [editingPickup, setEditingPickup] = useState(false);
  const [showPickupSheet, setShowPickupSheet] = useState(false);

  /* ── Step 3 – Drop ── */
  const [drop, setDrop] = useState({ ...EMPTY_ADDR });
  const [dropSource, setDropSource] = useState('');
  const [editingDrop, setEditingDrop] = useState(false);
  const [showDropSheet, setShowDropSheet] = useState(false);

  const [myAddrs, setMyAddrs] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);

  /* ── Step 4 – Items ── */
  const [items, setItems] = useState([]);  // initialized after catalog loads
  const [expandedItem, setExpandedItem] = useState(0);
  const [uploadingImg, setUploadingImg] = useState({});
  const [preparingDraft, setPreparingDraft] = useState(false);

  /* ── Step 5 – Payment ── */
  const [draftOrder, setDraftOrder] = useState(null);
  const [itemsSnapshot, setItemsSnapshot] = useState(null);
  const [billing, setBilling] = useState(null);
  const [isSelfHandling, setIsSelfHandling] = useState(false);
  const [offerCode, setOfferCode] = useState('');
  const [offerApplied, setOfferApplied] = useState(null);
  const [offerError, setOfferError] = useState('');
  const [applyingOffer, setApplyingOffer] = useState(false);
  const [removingOffer, setRemovingOffer] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [activeOffers, setActiveOffers] = useState([]);
  const [showOffers, setShowOffers] = useState(false);
  const [payMode, setPayMode] = useState('RAZORPAY');
  const [codBlocked, setCodBlocked] = useState(false);

  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);

  // FIX: Use a ref to track if catalog is loaded before initializing item defaults
  const catalogReadyRef = useRef(false);

  /* ─── Load catalog ─── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [sizesRes, typesRes, catsRes] = await Promise.all([
          itemCatalogAPI.getSizes(),
          itemCatalogAPI.getTypes(),
          itemCatalogAPI.getCategories(),
        ]);
        if (!mounted) return;
        const sizes = sizesRes.data.data;
        const types = typesRes.data.data;
        const cats = catsRes.data.data;
        if (sizes?.length) setCatalogSizes(sizes);
        if (types?.length) setCatalogTypes(types);
        if (cats?.length) setCatalogCategories(cats);
        const defSize = getCatalogKey(sizes?.[0]) || 'SMALL';
        const defType = getCatalogKey(types?.[0]) || 'FRAGILE';
        const defCat = getCatalogKey(cats?.[0]) || 'DOCUMENT';
        catalogReadyRef.current = true;
        // FIX: Initialize items AFTER catalog is loaded to avoid wrong defaults
        setItems(prev =>
          prev.length === 0
            ? [{ name: '', quantity: 1, type: defType, category: defCat, size: defSize, images: [] }]
            : prev.map(item =>
              item.size === '' && item.type === '' && item.category === ''
                ? { ...item, size: defSize, type: defType, category: defCat }
                : item
            )
        );
      } catch {
        catalogReadyRef.current = true;
        setItems(prev =>
          prev.length === 0
            ? [{ name: '', quantity: 1, type: 'FRAGILE', category: 'DOCUMENT', size: 'SMALL', images: [] }]
            : prev
        );
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ─── Init: profile + addresses + Razorpay + drafts ─── */
  useEffect(() => {
    if (user) {
      setSenderFirstName(user.firstName || '');
      setSenderLastName(user.lastName || '');
      setSenderPhone(user.phoneNumber || '');
    }

    profileAPI.getMe()
      .then(({ data }) => {
        const u = data.data || data;
        setSenderFirstName(u.firstName || '');
        setSenderLastName(u.lastName || '');
        setSenderPhone(u.phoneNumber || '');
        if (u.codBlocked) { setCodBlocked(true); setPayMode('RAZORPAY'); }
      })
      .catch(() => { })
      .finally(() => setSenderLoading(false));

    addressesAPI.getAll().then(({ data }) => {
      const addrs = data.data || [];
      setMyAddrs(addrs);
      const pref = addrs.find(a => a.isPreferredPickup);
      if (pref) { setPickup(addrFromSaved(pref)); setPickupSource('preferred'); }
    }).catch(() => { });

    if (!window.Razorpay) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.head.appendChild(s);
    }

    ordersAPI.getMyDrafts()
      .then(({ data }) => {
        const drafts = data.data || [];
        setDraftOrders(drafts);
        if (drafts.length > 0) setShowDraftScreen(true);
      })
      .catch(() => { })
      .finally(() => setDraftsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Receiver lookup ─── */
  const lookupReceiver = useCallback(async () => {
    const phone = normalizePhone(rawPhone);
    if (!phone) { setLookupError('Enter a valid 10-digit mobile number'); return; }
    setLookingUp(true); setLookupError(''); setLookupDone(false); setReceiverFound(false);
    try {
      const { data } = await ordersAPI.getReceiverInfo(phone);
      const info = data.data || data;
      setLookupDone(true);
      if (info.found) {
        setReceiverFound(true);
        if (!firstName.trim() && info.firstName) setFirstName(info.firstName);
        if (!lastName.trim() && info.lastName) setLastName(info.lastName);
        if (info.preferredDropAddress) {
          const a = addrFromPersisted(info.preferredDropAddress);
          if (!a.contactPerson) a.contactPerson = info.firstName || '';
          if (!a.contactNumber) a.contactNumber = phone;
          setDrop(a); setDropSource('receiver');
        } else {
          setDrop({ ...EMPTY_ADDR }); setDropSource('');
        }
      } else {
        setReceiverFound(false); setDrop({ ...EMPTY_ADDR }); setDropSource('');
      }
    } catch {
      setLookupError('Could not look up this number. Try again.');
    } finally {
      setLookingUp(false);
    }
  }, [rawPhone, firstName, lastName]);

  /* ─── buildPayload — stable with useCallback ─── */
  // FIX: Memoized so it doesn't cause downstream useEffect re-runs
  const buildPayload = useCallback(() => ({
    receiverPhone: normalizePhone(rawPhone) || rawPhone,
    receiverFirstName: firstName.trim(),
    receiverLastName: lastName.trim(),
    pickup: sanitizeAddr(pickup),
    drop: sanitizeAddr(drop),
    items,
    paymentMode: payMode === 'RAZORPAY' ? 'UPI' : payMode,
    isSelfHandling,
  }), [rawPhone, firstName, lastName, pickup, drop, items, payMode, isSelfHandling]);

  /* ─── prepareDraft — stable with useCallback ─── */
  // FIX: No longer causes infinite loop — dependencies are stable
  const prepareDraft = useCallback(async () => {
    setPreparingDraft(true); setError('');
    try {
      const payload = buildPayload();
      if (!payload.pickup.latitude || !payload.pickup.longitude) {
        setError('Pickup address is missing coordinates. Please edit and add them.'); return;
      }
      if (!payload.drop.latitude || !payload.drop.longitude) {
        setError('Drop address is missing coordinates. Please edit and add them.'); return;
      }
      const { data } = await ordersAPI.prepare(payload);
      const order = data.data || data;
      setDraftOrder(order); setBilling(order.billing);
      setItemsSnapshot(JSON.stringify(items));
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setPreparingDraft(false);
    }
  }, [buildPayload, items]);

  /* ─── Auto-prepare draft on step 5 ─── */
  // FIX: Added preparingDraft + draftOrder checks AND prepareDraft is now stable
  const hasPreparedRef = useRef(false);
  useEffect(() => {
    if (step === 5 && !billing && !preparingDraft && !draftOrder && !hasPreparedRef.current) {
      hasPreparedRef.current = true;
      prepareDraft();
    }
    if (step !== 5) hasPreparedRef.current = false;
  }, [step, billing, preparingDraft, draftOrder, prepareDraft]);

  /* ─── Offers ─── */
  useEffect(() => {
    if (step !== 5) return;
    const amount = billing?.payableAmount || 0;
    offersAPI.getAll(amount)
      .then(({ data }) => setActiveOffers(data.data || []))
      .catch(() => { });
  }, [step, billing?.payableAmount]);

  /* ─── Availability check ─── */
  const checkAvail = useCallback(async () => {
    if (!pickup.latitude || !drop.latitude) return;
    setAvailability(null); setCheckingAvail(true);
    try {
      const { data } = await ordersAPI.checkAvailability({
        pickupLat: pickup.latitude, pickupLng: pickup.longitude,
        dropLat: drop.latitude, dropLng: drop.longitude,
      });
      setAvailability(data.data || data);
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAvail(false);
    }
  }, [pickup.latitude, pickup.longitude, drop.latitude, drop.longitude]);

  // FIX: Only runs checkAvail when ALL four coordinates are non-null
  useEffect(() => {
    if (step === 3 && pickup.latitude && pickup.longitude && drop.latitude && drop.longitude) {
      checkAvail();
    }
  }, [step, pickup.latitude, pickup.longitude, drop.latitude, drop.longitude, checkAvail]);

  /* ─── Item helpers — stable with useCallback ─── */
  const updateItem = useCallback((idx, updated) => {
    setItems(prev => { const n = [...prev]; n[idx] = updated; return n; });
  }, []);

  const deleteItem = useCallback((idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setExpandedItem(prev => {
      if (prev === idx) return Math.max(0, idx - 1);
      if (prev > idx) return prev - 1;
      return prev;
    });
  }, []);

  const addItem = useCallback(() => {
    const defSize = getCatalogKey(catalogSizes[0]) || 'SMALL';
    const defType = getCatalogKey(catalogTypes[0]) || 'DOCUMENT';
    const defCat = getCatalogKey(catalogCategories[0]) || 'OTHER';
    setItems(prev => {
      const newIdx = prev.length;
      setExpandedItem(newIdx);
      return [...prev, { name: '', quantity: 1, type: defType, category: defCat, size: defSize, images: [] }];
    });
  }, [catalogSizes, catalogTypes, catalogCategories]);

  // FIX: Use functional updater to avoid stale `items` closure
  const handleImageUpload = useCallback(async (idx, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImg(u => ({ ...u, [idx]: true }));
    try {
      const uploaded = await Promise.all(files.map(f => filesAPI.upload(f).then(r => r.data.data.url)));
      setItems(prev => {
        const n = [...prev];
        n[idx] = { ...n[idx], images: [...(n[idx].images || []), ...uploaded] };
        return n;
      });
    } catch {
      setError('Image upload failed. Please try again.');
    } finally {
      setUploadingImg(u => ({ ...u, [idx]: false }));
      e.target.value = '';
    }
  }, []);

  /* ─── Apply offer ─── */
  const handleApplyOffer = useCallback(async (codeOverride) => {
    const code = (codeOverride || offerCode).trim().toUpperCase();
    if (!code) { setOfferError('Enter an offer code'); return; }
    if (!draftOrder) { setOfferError('Draft not ready — go back and re-confirm your items'); return; }
    setApplyingOffer(true); setOfferError(''); setOfferCode(code);
    try {
      const { data } = await ordersAPI.applyOffer(draftOrder.orderId, code);
      const updated = data.data || data;
      setDraftOrder(updated); setBilling(updated.billing);
      const found = activeOffers.find(o => o.offerCode === code);
      setOfferApplied({
        code, name: found?.offerName ?? code, type: found?.offerType ?? 'FLAT',
        value: found?.discountValue ?? 0, maxDiscount: found?.maxDiscountAmount ?? 0,
        minOrder: found?.minOrderAmount ?? 0,
      });
      setShowOffers(false);
    } catch (e) {
      setOfferError(extractApiError(e));
    } finally {
      setApplyingOffer(false);
    }
  }, [offerCode, draftOrder, activeOffers]);

  /* ─── Remove offer ─── */
  const handleRemoveOffer = useCallback(async () => {
    if (!draftOrder) return;
    setRemovingOffer(true);
    try {
      const { data } = await ordersAPI.prepare(buildPayload());
      const updated = data.data || data;
      setDraftOrder(updated); setBilling(updated.billing);
      setOfferApplied(null); setOfferCode(''); setOfferError('');
    } catch (_) { }
    finally { setRemovingOffer(false); }
  }, [draftOrder, buildPayload]);

  /* ─── Recalculate billing ─── */
  const recalculateBilling = useCallback(async (newSelfHandling) => {
    if (!draftOrder) return;
    setRecalculating(true);
    try {
      const payload = { ...buildPayload(), isSelfHandling: newSelfHandling };
      const { data } = await ordersAPI.prepare(payload);
      const updated = data.data || data;
      setDraftOrder(updated); setBilling(updated.billing);
      if (offerApplied) {
        try {
          const { data: od } = await ordersAPI.applyOffer(updated.orderId, offerApplied.code);
          const withOffer = od.data || od;
          setDraftOrder(withOffer); setBilling(withOffer.billing);
        } catch (_) { }
      }
    } catch (_) { }
    finally { setRecalculating(false); }
  }, [draftOrder, buildPayload, offerApplied]);

  /* ─── COD ─── */
  const placeOrderCOD = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await ordersAPI.placeDraft(draftOrder.orderId, {
        offerCode: offerApplied?.code, isSelfHandling, paymentMode: 'COD',
      });
      setPlacedOrder(data.data || data);
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }, [draftOrder, offerApplied, isSelfHandling]);

  /* ─── Online payment ─── */
  const placeOrderOnline = useCallback(async () => {
    setPayLoading(true); setError('');
    try {
      const amount = billing?.payableAmount || 1;
      const { data: pd } = await paymentsAPI.initiate({
        orderId: draftOrder.orderId, amount,
        customerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Customer',
        customerPhone: user?.phoneNumber || '',
        customerEmail: user?.email || '',
      });
      const payData = pd.data || pd;
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: Math.round(amount * 100), currency: 'INR',
          order_id: payData.gatewayOrderId,
          name: 'Bhada Delivery', description: `Order #${draftOrder.orderId?.slice(-8)}`,
          prefill: { name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(), contact: user?.phoneNumber || '', email: user?.email || '' },
          theme: { color: '#4F6EF7' },
          handler: async (resp) => {
            try {
              await paymentsAPI.verify(payData.paymentId, {
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
                orderId: draftOrder.orderId,
              });
              resolve();
            } catch (err) { reject(err); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rzp.open();
      });
      const { data: orderData } = await ordersAPI.getById(draftOrder.orderId);
      setPlacedOrder(orderData.data || orderData);
    } catch (e) {
      if (e.message !== 'Payment cancelled') setError(extractApiError(e));
    } finally {
      setPayLoading(false);
    }
  }, [billing, draftOrder, user]);

  /* ─── Draft: delete ─── */
  const handleDeleteDraft = useCallback(async (orderId) => {
    setDeletingDraftId(orderId);
    try {
      await ordersAPI.deleteDraft(orderId);
      setDraftOrders(prev => {
        const remaining = prev.filter(d => d.orderId !== orderId);
        if (remaining.length === 0) setShowDraftScreen(false);
        return remaining;
      });
    } catch (e) {
      setError(extractApiError(e));
    } finally {
      setDeletingDraftId(null);
    }
  }, []);

  /* ─── Draft: resume ─── */
  const handleResumeDraft = useCallback((draft) => {
    const phone = draft.billing?.customerDetails?.phoneNumber || draft.receiver?.phoneNumber || '';
    setRawPhone(phone.replace(/^\+91/, ''));
    setFirstName(draft.receiver?.firstName || '');
    setLastName(draft.receiver?.lastName || '');
    setLookupDone(true); setReceiverFound(true);
    if (draft.senderNode) { setPickup(addrFromPersisted(draft.senderNode)); setPickupSource('draft'); }
    if (draft.receiverNode) { setDrop(addrFromPersisted(draft.receiverNode)); setDropSource('draft'); }
    if (draft.items?.length) {
      const defSize = getCatalogKey(catalogSizes[0]) || '';
      const defType = getCatalogKey(catalogTypes[0]) || '';
      const defCat = getCatalogKey(catalogCategories[0]) || '';
      setItems(draft.items.map(i => ({
        name: i.name || '',
        quantity: i.quantity || 1,
        type: i.type || defType,
        category: i.category || defCat,
        size: i.size || defSize,
        images: i.images || [],
      })));
    }
    setDraftOrder({ orderId: draft.orderId, ...draft });
    setBilling(draft.billing || null);
    setIsSelfHandling(draft.isSelfHandling ?? false);
    setShowDraftScreen(false);
    setStep(5);
  }, [catalogSizes, catalogTypes, catalogCategories]);

  /* ─── goNext ─── */
  const goNext = useCallback(async () => {
    setError('');
    if (step === 0) {
      if (!senderFirstName.trim()) { setError('Enter your first name'); return; }
    }
    if (step === 1) {
      if (rawPhone.length !== 10) { setError('Enter a 10-digit mobile number'); return; }
      if (!lookupDone) { setError('Tap "Look up" to check the receiver first'); return; }
      if (!firstName.trim()) { setError("Enter the receiver's first name"); return; }
    }
    if (step === 2) {
      if (!pickup.street || !pickup.city) { setError('Fill in pickup street and city'); return; }
      if (!pickup.latitude || !pickup.longitude) { setError('Pickup address is missing coordinates.'); return; }
    }
    if (step === 3) {
      if (!drop.street || !drop.city) { setError('Fill in drop street and city'); return; }
      if (!pickup.latitude || !pickup.longitude || !drop.latitude || !drop.longitude) {
        setError('Both addresses must have coordinates'); return;
      }
      if (checkingAvail) { setError('Checking availability, please wait…'); return; }
      if (!availability) { await checkAvail(); return; }
      if (!availability.available) return; // alert already shown in UI above
    }
    if (step === 4) {
      if (items.some(i => !i.name.trim())) { setError('All items need a name'); return; }
      const currentItemsJson = JSON.stringify(items);
      if (draftOrder && billing && itemsSnapshot === currentItemsJson) {
        setStep(5); return;
      }
      // Items changed — delete stale draft silently
      if (draftOrder?.orderId) {
        try { await ordersAPI.deleteDraft(draftOrder.orderId); } catch (_) { }
      }
      setBilling(null); setDraftOrder(null); setOfferApplied(null); setOfferCode('');
      hasPreparedRef.current = false;
      setStep(5); return;
    }
    if (step === 5) { setStep(6); return; }
    if (step === 6) {
      if (placedOrder) { navigate(`/orders/${placedOrder.orderId}`, { replace: true }); return; }
      if (payMode === 'RAZORPAY') await placeOrderOnline();
      else await placeOrderCOD();
      return;
    }
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }, [
    step, senderFirstName, rawPhone, lookupDone, firstName,
    pickup, drop, checkingAvail, availability, checkAvail,
    items, draftOrder, billing, itemsSnapshot,
    placedOrder, payMode, placeOrderOnline, placeOrderCOD, navigate,
  ]);

  const goBack = useCallback(() => {
    setError('');
    if (step === 5) { setOfferApplied(null); setOfferCode(''); }
    if (step > 0) setStep(s => s - 1); else navigate(-1);
  }, [step, navigate]);

  const applyToPickup = useCallback((saved) => {
    setPickup(addrFromSaved(saved)); setPickupSource('saved');
    setAvailability(null); setEditingPickup(false); setShowPickupSheet(false);
  }, []);

  const applyToDrop = useCallback((saved) => {
    setDrop(addrFromSaved(saved)); setDropSource('sender');
    setAvailability(null); setEditingDrop(false); setShowDropSheet(false);
  }, []);

  // NEW: Save address to user's saved list
  const handleSaveAddress = useCallback(async (addr, type) => {
    try {
      await addressesAPI.create({
        ...addr,
        label: type === 'pickup' ? 'My Pickup' : 'My Drop',
        isPreferredPickup: type === 'pickup',
        isPreferredDrop: type === 'drop',
      });
      const { data } = await addressesAPI.getAll();
      setMyAddrs(data.data || []);
    } catch {
      // silent — non-critical
    }
  }, []);

  /* ─── Derived ─── */
  const pickupReady = !!(pickup.street && pickup.city);
  const dropReady = !!(drop.street && drop.city);
  const isBusy = loading || payLoading || preparingDraft;

  // Only named items count — empty items are "in progress" and not counted
  const namedItems = useMemo(() => items.filter(i => i.name.trim()), [items]);
  const totalItemCount = useMemo(() => namedItems.reduce((t, i) => t + (i.quantity || 1), 0), [namedItems]);

  const btnLabel = () => {
    if (isBusy) return <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }} /> Processing…</>;
    if (step === 4) return preparingDraft ? 'Calculating…' : '→ Calculate & Continue';
    if (step === 5) return '→ Review Order';
    if (step === 6) {
      if (placedOrder) return 'Track Order';
      return payMode === 'RAZORPAY' ? '💳 Pay & Place Order' : '✓ Place Order (COD)';
    }
    return 'Continue →';
  };

  /* ════════════════════════════ RENDER ════════════════════════════ */

  /* ── Draft Selection Screen ── */
  if (showDraftScreen) {
    return (
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <div className="page-header" style={{ top: 0, zIndex: 20 }}>
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
          <div>
            <div className="page-title">New Order</div>
            <div className="page-subtitle">You have unfinished orders</div>
          </div>
        </div>

        <div style={{ padding: '16px', paddingBottom: 100 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(234,88,12,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📋</div>
              <div>
                <div className="label-sm">Resume a Draft Order</div>
                <div className="body-xs" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {draftOrders.length} saved draft{draftOrders.length !== 1 ? 's' : ''} — tap to continue where you left off
                </div>
              </div>
            </div>

            {draftsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, margin: '0 auto 8px' }} />
                <div className="body-xs">Loading drafts…</div>
              </div>
            ) : draftOrders.map((draft, idx) => {
              const b = draft.billing;
              const dPickup = draft.senderNode;
              const dDrop = draft.receiverNode;
              const receiver = draft.receiver;
              const itemCount = (draft.items || []).reduce((t, i) => t + (i.quantity || 1), 0);
              const createdAt = draft.createdAt
                ? new Date(draft.createdAt?.seconds ? draft.createdAt.seconds * 1000 : draft.createdAt)
                : null;
              const isDeleting = deletingDraftId === draft.orderId;
              return (
                <div key={draft.orderId} style={{ border: '1.5px solid var(--border-md)', borderRadius: 'var(--radius-sm)', marginBottom: idx < draftOrders.length - 1 ? 10 : 0, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 14px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--orange)', background: 'rgba(234,88,12,0.1)', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.05em' }}>DRAFT</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>#{draft.orderId?.slice(-8).toUpperCase()}</span>
                    </div>
                    {createdAt && (
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '10px 14px', display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 3 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 2px rgba(22,163,74,0.15)' }} />
                      <div style={{ width: 2, height: 20, background: 'var(--border-md)', borderRadius: 1 }} />
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>PICKUP</div>
                        <div className="body-xs" style={{ color: 'var(--text-secondary)' }}>
                          {[dPickup?.buildingOrFlat, dPickup?.street, dPickup?.area, dPickup?.city].filter(Boolean).join(', ') || 'Not set'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>DROP</div>
                        <div className="body-xs" style={{ color: 'var(--text-secondary)' }}>
                          {[dDrop?.buildingOrFlat, dDrop?.street, dDrop?.area, dDrop?.city].filter(Boolean).join(', ') || 'Not set'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {receiver && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        👤 {receiver.firstName} {receiver.lastName}
                      </span>
                    )}
                    {itemCount > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        📦 {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {b?.payableAmount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                        ₹{Number(b.payableAmount).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={isDeleting} onClick={() => handleResumeDraft(draft)}>
                      <Check size={13} /> Continue Order
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)', border: '1.5px solid rgba(239,68,68,0.25)', minWidth: 80 }}
                      disabled={isDeleting}
                      onClick={() => handleDeleteDraft(draft.orderId)}
                    >
                      {isDeleting
                        ? <div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                        : <><Trash2 size={13} /> Delete</>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

          <button className="btn btn-secondary btn-full btn-lg" onClick={() => setShowDraftScreen(false)}>
            <Plus size={15} /> Start a New Order Instead
          </button>
        </div>
      </div>
    );
  }

  /* ── Main flow ── */
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {showPickupSheet && (
        <AddressSheet title="Pickup Address" savedAddresses={myAddrs} onPick={applyToPickup} onManual={() => { setShowPickupSheet(false); setEditingPickup(true); }} onClose={() => setShowPickupSheet(false)} />
      )}
      {showDropSheet && (
        <AddressSheet title="Drop Address" savedAddresses={myAddrs} onPick={applyToDrop} onManual={() => { setShowDropSheet(false); setEditingDrop(true); }} onClose={() => setShowDropSheet(false)} />
      )}

      <div className="page-header" style={{ top: 0, zIndex: 20 }}>
        <button className="btn btn-ghost btn-icon-sm" onClick={goBack}><ArrowLeft size={16} /></button>
        <div>
          <div className="page-title">New Order</div>
          <div className="page-subtitle">Step {step + 1} of {STEPS.length} · {STEPS[step].label}</div>
        </div>
      </div>

      <StepBar step={step} itemCount={totalItemCount} />

      <div style={{ padding: '16px', paddingBottom: 100 }}>

        {/* ══ STEP 0 — SENDER ══ */}
        {step === 0 && (
          <div className="col gap-12">
            <div className="card">
              <SectionHead emoji="🙋" title="Your Details" sub="Confirm your sender info before placing the order" />
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={11} /> Your Mobile Number
                  <span style={{ marginLeft: 4, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    <Lock size={9} /> not editable
                  </span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    value={senderPhone ? `+91 ${senderPhone.replace(/^\+91/, '').replace(/^91/, '')}` : '—'}
                    readOnly
                    style={{ background: 'var(--bg-overlay)', color: 'var(--text-tertiary)', cursor: 'not-allowed', paddingRight: 36 }}
                  />
                  <Lock size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  Registered number — cannot be changed here
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="input" placeholder="Rahul" value={senderFirstName} onChange={e => setSenderFirstName(e.target.value)} />
                  {senderFirstName.trim().length > 0 && senderFirstName.trim().length < 2 && (
                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>Too short</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="input" placeholder="Sharma" value={senderLastName} onChange={e => setSenderLastName(e.target.value)} />
                </div>
              </div>
              {senderLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--text-tertiary)', fontSize: 11 }}>
                  <div className="spinner" style={{ width: 11, height: 11, borderWidth: 2 }} /> Loading your profile…
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent-ring)', borderRadius: 'var(--radius-sm)', padding: '11px 13px' }}>
              <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
              <div className="body-xs" style={{ lineHeight: 1.7 }}>
                Your phone number is linked to your account and is used to track this order.
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 1 — RECEIVER ══ */}
        {step === 1 && (
          <div className="col gap-12">
            <div className="card">
              <SectionHead emoji="👤" title="Who is receiving this?" />
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Receiver's Mobile Number</label>
                <div className="row gap-8">
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>+91</span>
                    <input
                      className="input" type="tel" inputMode="numeric" placeholder="98765 43210"
                      style={{ paddingLeft: 44 }}
                      value={rawPhone}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setRawPhone(v);
                        if (v !== rawPhone) { setLookupDone(false); setReceiverFound(false); setLookupError(''); setDropSource(''); setDrop({ ...EMPTY_ADDR }); }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' && rawPhone.length === 10) lookupReceiver(); }}
                    />
                  </div>
                  <button
                    className="btn btn-primary" style={{ flexShrink: 0, minWidth: 82 }}
                    disabled={rawPhone.length !== 10 || lookingUp}
                    onClick={lookupReceiver}
                  >
                    {lookingUp
                      ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} />
                      : lookupDone ? <><RefreshCw size={13} /> Re-check</> : 'Look up'
                    }
                  </button>
                </div>
                {/* NEW: real-time phone length indicator */}
                {rawPhone.length > 0 && rawPhone.length < 10 && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                    {10 - rawPhone.length} more digit{10 - rawPhone.length !== 1 ? 's' : ''} needed
                  </div>
                )}
              </div>
              {lookupDone && receiverFound && (
                <div style={{ display: 'flex', gap: 10, background: 'var(--green-dim)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div className="body-sm font-semibold" style={{ color: 'var(--green)' }}>Receiver found</div>
                    <div className="body-xs" style={{ marginTop: 2 }}>{dropSource === 'receiver' ? '✓ Preferred drop address loaded.' : 'No preferred drop — enter in Drop step.'}</div>
                  </div>
                </div>
              )}
              {lookupDone && !receiverFound && (
                <div style={{ display: 'flex', gap: 10, background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
                  <AlertCircle size={15} style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div className="body-sm font-semibold" style={{ color: 'var(--orange)' }}>New receiver</div>
                    <div className="body-xs" style={{ marginTop: 2 }}>Not registered — you can still place the order.</div>
                  </div>
                </div>
              )}
              {lookupError && <div className="alert alert-error" style={{ marginBottom: 12 }}><AlertCircle size={14} /> {lookupError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="input" placeholder="Rahul" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="input" placeholder="Sharma" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent-ring)', borderRadius: 'var(--radius-sm)', padding: '11px 13px' }}>
              <Phone size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
              <div className="body-xs" style={{ lineHeight: 1.7 }}>Enter the receiver's number and tap <strong>Look up</strong>. Preferred drop address will be auto-filled if available.</div>
            </div>
          </div>
        )}

        {/* ══ STEP 2 — PICKUP ══ */}
        {step === 2 && (
          <div className="col gap-12">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📍</div>
                <div>
                  <div className="label-sm">Pickup Address</div>
                  {pickupSource === 'preferred' && <div style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> YOUR PREFERRED PICKUP</div>}
                  {pickupSource === 'saved' && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2 }}>FROM SAVED ADDRESSES</div>}
                  {!pickupSource && !pickupReady && <div className="body-xs" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Where to collect the parcel from</div>}
                </div>
              </div>
              {!editingPickup ? (
                pickupReady ? (
                  <div className="col gap-8">
                    <AddrTile label="PICKUP" addr={pickup} dotColor="var(--green)" onEdit={() => setEditingPickup(true)} />
                    <div className="row gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingPickup(true)}><Edit2 size={11} /> Edit</button>
                      {myAddrs.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setShowPickupSheet(true)}><RefreshCw size={11} /> Change</button>}
                    </div>
                  </div>
                ) : (
                  <div className="col gap-8">
                    {myAddrs.length > 0 && <button className="btn btn-secondary btn-full" onClick={() => setShowPickupSheet(true)}><Star size={14} /> Choose from saved addresses</button>}
                    <button className="btn btn-ghost btn-full" onClick={() => setEditingPickup(true)}><Plus size={14} /> Enter manually</button>
                  </div>
                )
              ) : (
                <div className="col gap-10">
                  <AddrForm
                    addr={pickup}
                    onChange={a => { setPickup(typeof a === 'function' ? a(pickup) : a); setPickupSource('manual'); }}
                    savedAddresses={myAddrs}
                    onPickSaved={() => setShowPickupSheet(true)}
                    onSavePrompt={() => handleSaveAddress(pickup, 'pickup')}
                  />
                  {pickupReady && (
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEditingPickup(false)}>
                      <Check size={12} /> Done
                    </button>
                  )}
                </div>
              )}
            </div>
            {pickupSource === 'preferred' && !editingPickup && pickupReady && (
              <div style={{ display: 'flex', gap: 10, background: 'var(--green-dim)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 'var(--radius-sm)', padding: '11px 13px' }}>
                <Star size={14} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                <div className="body-xs" style={{ lineHeight: 1.7 }}>This is your <strong>preferred pickup address</strong>. Tap <strong>Change</strong> to use a different one.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 3 — DROP ══ */}
        {step === 3 && (
          <div className="col gap-12">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏁</div>
                <div>
                  <div className="label-sm">Drop Address</div>
                  {dropSource === 'receiver' && <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2 }}>✓ RECEIVER'S PREFERRED DROP</div>}
                  {dropSource === 'sender' && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 2 }}>FROM YOUR SAVED ADDRESSES</div>}
                  {!dropSource && !dropReady && <div className="body-xs" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>{receiverFound ? 'No preferred drop — set one below.' : 'Enter the drop address.'}</div>}
                </div>
              </div>
              {!editingDrop ? (
                dropReady ? (
                  <div className="col gap-8">
                    <AddrTile label="DROP" addr={drop} dotColor="var(--red)" onEdit={() => setEditingDrop(true)} />
                    <div className="row gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingDrop(true)}><Edit2 size={11} /> Edit</button>
                      {myAddrs.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setShowDropSheet(true)}><RefreshCw size={11} /> Change</button>}
                    </div>
                  </div>
                ) : (
                  <div className="col gap-8">
                    {myAddrs.length > 0 && <button className="btn btn-secondary btn-full" onClick={() => setShowDropSheet(true)}><Star size={14} /> Choose from saved addresses</button>}
                    <button className="btn btn-ghost btn-full" onClick={() => setEditingDrop(true)}><Plus size={14} /> Enter manually</button>
                  </div>
                )
              ) : (
                <div className="col gap-10">
                  <AddrForm
                    addr={drop}
                    onChange={a => { setDrop(typeof a === 'function' ? a(drop) : a); if (!dropSource) setDropSource('manual'); }}
                    savedAddresses={myAddrs}
                    onPickSaved={() => setShowDropSheet(true)}
                    onSavePrompt={() => handleSaveAddress(drop, 'drop')}
                  />
                  {dropReady && (
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEditingDrop(false)}>
                      <Check size={12} /> Done
                    </button>
                  )}
                </div>
              )}
            </div>
            {checkingAvail && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Checking service availability…</span>
              </div>
            )}
            {availability && !checkingAvail && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px',
                background: availability.available ? 'var(--green-dim)' : 'rgba(239,68,68,0.08)',
                border: `1.5px solid ${availability.available ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: availability.available ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.12)',
                }}>
                  {availability.available
                    ? <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                    : <AlertCircle size={16} style={{ color: '#ef4444' }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="body-sm font-semibold" style={{ color: availability.available ? 'var(--green)' : '#ef4444' }}>
                    {availability.available ? 'Service available on this route' : 'Service not available'}
                  </div>
                  {availability.message && (
                    <div style={{ fontSize: 12, color: availability.available ? 'var(--text-secondary)' : '#ef4444', marginTop: 3, opacity: 0.85 }}>
                      {availability.message}
                    </div>
                  )}
                  {availability.available && availability.estimatedFare && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Est. fare</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>₹{availability.estimatedFare}</span>
                      </div>
                      {availability.estimatedDistance && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Distance</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{availability.estimatedDistance} km</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!availability.available && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      Try changing your pickup or drop address to a serviceable area.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 4 — ITEMS ══ */}
        {step === 4 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div className="label-sm" style={{ marginBottom: 0 }}>Items</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {namedItems.length > 0 ? `${namedItems.length} item${namedItems.length !== 1 ? 's' : ''} named` : 'No items named yet'} · tap to expand
                  </div>
                </div>
              </div>
              {items.length > 1 && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setExpandedItem(expandedItem === null ? 0 : null)}>
                  {expandedItem === null ? <><ChevronDown size={11} /> Expand</> : <><ChevronUp size={11} /> Collapse all</>}
                </button>
              )}
            </div>

            {catalogLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: '0 auto 8px' }} />
                <div className="body-xs">Loading item catalog…</div>
              </div>
            ) : items.map((item, idx) => (
              <ItemCard
                key={idx}
                item={item} idx={idx}
                expanded={expandedItem === idx}
                onToggle={() => setExpandedItem(expandedItem === idx ? null : idx)}
                onChange={updated => updateItem(idx, updated)}
                onDelete={() => deleteItem(idx)}
                canDelete={items.length > 1}
                uploadingImg={!!uploadingImg[idx]}
                onUpload={e => handleImageUpload(idx, e)}
                onRemoveImage={imgIdx => updateItem(idx, { ...item, images: item.images.filter((_, i) => i !== imgIdx) })}
                catalogSizes={catalogSizes}
                catalogTypes={catalogTypes}
                catalogCategories={catalogCategories}
              />
            ))}

            <button
              className="btn btn-secondary btn-full"
              onClick={addItem}
              style={{ marginTop: 4, opacity: items[items.length - 1]?.name.trim() ? 1 : 0.45, pointerEvents: items[items.length - 1]?.name.trim() ? 'auto' : 'none' }}
              disabled={!items[items.length - 1]?.name.trim()}
              title={items[items.length - 1]?.name.trim() ? '' : 'Fill item name first'}
            >
              <Plus size={14} /> Add Another Item
            </button>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent-ring)', borderRadius: 'var(--radius-sm)', padding: '11px 13px' }}>
              <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
              <div className="body-xs" style={{ lineHeight: 1.7 }}>
                <strong>Item size is based on weight & dimensions:</strong>{' '}
                {catalogSizes.map((s, i) => (
                  <span key={i}>{i > 0 ? ', ' : ''}{getCatalogName(s)}{typeof s !== 'string' ? ` (${s.weightMin}–${s.weightMax} kg)` : ''}</span>
                ))}{'. '}The exact bill is calculated when you tap Continue.
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 5 — PAYMENT ══ */}
        {step === 5 && (
          <div className="col gap-12">
            {recalculating ? (
              <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, margin: '0 auto 8px' }} />
                <div className="body-xs">Recalculating…</div>
              </div>
            ) : billing
              ? <BillCard billing={billing} offerApplied={offerApplied} />
              : (
                <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-tertiary)' }}>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, margin: '0 auto 8px' }} />
                  <div className="body-xs">Calculating your bill…</div>
                </div>
              )
            }

            {/* Items breakdown */}
            {(() => {
              const sizeMap = {};
              catalogSizes.forEach((s, i) => {
                const key = getCatalogKey(s);
                sizeMap[key] = {
                  name: getCatalogName(s),
                  weight: typeof s !== 'string' ? `${s.weightMin}–${s.weightMax} kg` : '',
                  dim: (typeof s !== 'string' && s.dimensions) ? `${s.dimensions.width}W×${s.dimensions.length}L×${s.dimensions.height}H cm` : null,
                  order: i,
                  color: ['#64748b', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444'][i % 5],
                };
              });
              const grouped = items.reduce((acc, item) => {
                const s = item.size || getCatalogKey(catalogSizes[0]) || 'SMALL';
                if (!acc[s]) acc[s] = { count: 0, names: [] };
                acc[s].count += (item.quantity || 1);
                if (item.name.trim()) acc[s].names.push(item.name.trim());
                return acc;
              }, {});
              const rows = Object.keys(grouped).sort((a, b) => ((sizeMap[a]?.order ?? 99) - (sizeMap[b]?.order ?? 99)));
              return (
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Package size={14} style={{ color: 'var(--accent)' }} />
                    <span className="label-sm">Items ({totalItemCount} total)</span>
                  </div>
                  {rows.map((size, idx) => {
                    const g = grouped[size];
                    const meta = sizeMap[size] || { name: size, weight: '', dim: null, color: '#0ea5e9' };
                    const c = meta.color;
                    const abbr = meta.name.length <= 2 ? meta.name.toUpperCase() : meta.name.substring(0, 2).toUpperCase();
                    return (
                      <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c + '15' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: c, fontFamily: 'var(--font-mono)' }}>{abbr}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.name}</span>
                            {meta.weight && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: c + '18', color: c, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{meta.weight}</span>}
                            {meta.dim && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{meta.dim}</span>}
                          </div>
                          {g.names.length > 0 && (
                            <div className="body-xs" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {g.names.join(', ')}
                            </div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, minWidth: 28, height: 28, borderRadius: 8, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>×{g.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Offer section */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag size={14} style={{ color: 'var(--accent)' }} />
                  <span className="label-sm">Promo Code</span>
                </div>
                {activeOffers.length > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setShowOffers(v => !v)}>
                    {showOffers ? <><ChevronUp size={11} /> Hide</> : <><ChevronDown size={11} /> {activeOffers.length} offer{activeOffers.length !== 1 ? 's' : ''}</>}
                  </button>
                )}
              </div>
              {offerApplied ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--green-dim)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 10 }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="body-sm font-semibold" style={{ color: 'var(--green)' }}>{removingOffer ? 'Removing…' : offerApplied.code + ' applied!'}</div>
                    <div className="body-xs" style={{ marginTop: 2 }}>{offerApplied.name}</div>
                  </div>
                  <button className="btn btn-ghost btn-icon-sm" onClick={handleRemoveOffer} disabled={removingOffer} style={{ opacity: removingOffer ? 0.5 : 1 }}>
                    {removingOffer ? <div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> : <X size={14} />}
                  </button>
                </div>
              ) : (
                <div className="row gap-8" style={{ marginBottom: offerError ? 6 : showOffers && activeOffers.length ? 12 : 0 }}>
                  <input
                    className="input" style={{ flex: 1 }} placeholder="Enter offer code"
                    value={offerCode}
                    onChange={e => { setOfferCode(e.target.value.toUpperCase()); setOfferError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyOffer(); }}
                  />
                  <button className="btn btn-secondary" disabled={applyingOffer || !offerCode.trim()} onClick={() => handleApplyOffer()}>
                    {applyingOffer ? <Loader size={13} /> : 'Apply'}
                  </button>
                </div>
              )}
              {offerError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '8px 10px', marginTop: 4 }}>
                  <AlertCircle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span className="body-xs" style={{ color: '#ef4444' }}>{offerError}</span>
                </div>
              )}
              {showOffers && activeOffers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeOffers.map(o => {
                    const eligible = o.eligible !== false;
                    const isApplied = offerApplied?.code === o.offerCode;
                    const isSelected = !isApplied && offerCode === o.offerCode;
                    const discount = o.offerType === 'PERCENTAGE'
                      ? `${o.discountValue}% off${o.maxDiscountAmount > 0 ? ` · max ₹${o.maxDiscountAmount}` : ''}`
                      : `₹${o.discountValue} off`;
                    return (
                      <div
                        key={o.offerId || o.offerCode}
                        onClick={() => { if (!eligible || isApplied) return; setOfferCode(o.offerCode); setOfferError(''); }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${isApplied ? 'var(--green)' : isSelected ? 'var(--accent)' : eligible ? 'var(--border-md)' : 'var(--border)'}`,
                          background: isApplied ? 'var(--green-dim)' : isSelected ? 'var(--accent-dim)' : eligible ? 'var(--bg-elevated)' : 'var(--bg-base)',
                          opacity: eligible ? 1 : 0.5,
                          cursor: eligible && !isApplied ? 'pointer' : 'default',
                          transition: 'all var(--dur)',
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isApplied ? 'rgba(22,163,74,0.15)' : eligible ? 'var(--accent-dim)' : 'var(--bg-overlay)' }}>
                          <Percent size={15} style={{ color: isApplied ? 'var(--green)' : eligible ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: isApplied ? 'var(--green)' : eligible ? 'var(--accent)' : 'var(--text-tertiary)' }}>{o.offerCode}</span>
                            {isApplied && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--green)', color: '#fff', fontFamily: 'var(--font-mono)' }}>APPLIED</span>}
                            {!eligible && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-overlay)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>UNAVAILABLE</span>}
                          </div>
                          <div className="body-xs" style={{ color: eligible ? 'var(--text-secondary)' : 'var(--text-tertiary)', marginBottom: 4 }}>{o.offerName}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isApplied ? 'var(--green)' : eligible ? 'var(--accent)' : 'var(--text-tertiary)' }}>{discount}</span>
                            {o.minOrderAmount > 0 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Min ₹{o.minOrderAmount}</span>}
                            {o.validUntil && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Till {new Date(o.validUntil?.seconds ? o.validUntil.seconds * 1000 : o.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                          </div>
                          {!eligible && o.ineligibleReason && (
                            <div style={{ marginTop: 5, fontSize: 10, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={10} /> {o.ineligibleReason}
                            </div>
                          )}
                        </div>
                        {eligible && !isApplied && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ flexShrink: 0, fontSize: 11, padding: '4px 10px', alignSelf: 'center' }}
                            disabled={applyingOffer}
                            onClick={e => { e.stopPropagation(); handleApplyOffer(o.offerCode); }}
                          >
                            {applyingOffer && offerCode === o.offerCode ? <Loader size={11} /> : 'Apply'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Self handling */}
            <div
              className="card"
              onClick={() => { if (recalculating) return; const next = !isSelfHandling; setIsSelfHandling(next); recalculateBilling(next); }}
              style={{ cursor: recalculating ? 'wait' : 'pointer', opacity: recalculating ? 0.7 : 1, transition: 'opacity 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative', background: isSelfHandling ? 'var(--accent)' : 'var(--border-md)', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 3, left: isSelfHandling ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="body-sm font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} style={{ color: isSelfHandling ? 'var(--accent)' : 'var(--text-tertiary)' }} /> Self Handling
                  </div>
                  <div className="body-xs" style={{ marginTop: 2, color: 'var(--text-secondary)' }}>You hand over the parcel directly to the rider</div>
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="card">
              <div className="label-sm" style={{ marginBottom: 12 }}>Payment Method</div>
              {[
                { mode: 'RAZORPAY', icon: <CreditCard size={17} />, title: 'Pay Online', sub: 'UPI, Cards, Net Banking, Wallets' },
                { mode: 'COD', icon: <Wallet size={17} />, title: 'Cash on Delivery', sub: codBlocked ? 'Not available — low Customer Value score' : 'Pay when parcel is picked up' },
              ].map(({ mode, icon, title, sub }) => {
                const blocked = mode === 'COD' && codBlocked;
                return (
                  <div
                    key={mode}
                    onClick={() => !blocked && setPayMode(mode)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                      cursor: blocked ? 'not-allowed' : 'pointer', marginBottom: 8,
                      border: `1.5px solid ${payMode === mode && !blocked ? 'var(--accent)' : 'var(--border-md)'}`,
                      background: blocked ? 'var(--bg-muted, rgba(255,255,255,0.03))' : payMode === mode ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      transition: 'all var(--dur)', opacity: blocked ? 0.5 : 1,
                    }}
                  >
                    <div style={{ color: payMode === mode ? 'var(--accent)' : 'var(--text-tertiary)' }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="body-sm font-semibold">{title}</div>
                      <div className="body-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${payMode === mode && !blocked ? 'var(--accent)' : 'var(--border-md)'}`, background: payMode === mode && !blocked ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--dur)', flexShrink: 0 }}>
                      {payMode === mode && !blocked && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP 6 — CONFIRM ══ */}
        {step === 6 && (
          <>
            {placedOrder ? (
              <div className="col gap-12">
                <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle2 size={32} style={{ color: 'var(--green)' }} />
                  </div>
                  <div className="title-sm" style={{ marginBottom: 6 }}>{payMode === 'COD' ? 'Order Placed!' : 'Payment Successful!'}</div>
                  <div className="body-xs" style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Order #{(placedOrder.orderId || '').slice(-8).toUpperCase()} · Riders are being notified
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
                    ₹{Number(placedOrder.billing?.payableAmount || billing?.payableAmount || 0).toFixed(2)}
                  </div>
                  <div className="body-xs" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>{payMode === 'COD' ? 'Cash on Delivery' : 'Paid Online'}</div>
                </div>
                <button className="btn btn-primary btn-full" onClick={() => navigate(`/orders/${placedOrder.orderId}`, { replace: true })}>Track Order</button>
                <button className="btn btn-ghost btn-full" onClick={() => navigate('/', { replace: true })}>Back to Home</button>
              </div>
            ) : (
              <>
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="label-sm" style={{ marginBottom: 14 }}>Route</div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 3px rgba(22,163,74,0.15)' }} />
                      <div style={{ width: 2, flex: 1, minHeight: 28, background: 'var(--border-md)', borderRadius: 1 }} />
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>PICKUP</div>
                        {pickup.contactPerson && <div className="body-sm font-semibold">{pickup.contactPerson}</div>}
                        <div className="body-xs" style={{ color: 'var(--text-secondary)' }}>{addrSummary(pickup)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>DROP</div>
                        <div className="body-sm font-semibold">{drop.contactPerson || firstName}</div>
                        <div className="body-xs" style={{ color: 'var(--text-secondary)' }}>{addrSummary(drop)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="label-sm" style={{ marginBottom: 12 }}>Order Details</div>
                  {[
                    { label: 'Sender', val: `${senderFirstName} ${senderLastName} · ${senderPhone}`.trim() },
                    { label: 'Receiver', val: `${firstName} ${lastName} · +91${rawPhone}`.trim() },
                    { label: 'Items', val: `${items.length} item${items.length !== 1 ? 's' : ''} · ${items.map(i => i.name).filter(Boolean).join(', ')}` },
                    { label: 'Self Handling', val: isSelfHandling ? 'Yes — hand over to rider' : 'No' },
                    { label: 'Payment', val: payMode === 'RAZORPAY' ? 'Online (Razorpay)' : 'Cash on Delivery' },
                    ...(offerApplied ? [{ label: 'Offer', val: offerApplied.code }] : []),
                  ].map(({ label, val }) => (
                    <div key={label} className="summary-row">
                      <span className="key">{label}</span>
                      <span className="val" style={{ maxWidth: 200, textAlign: 'right', fontSize: 12 }}>{val}</span>
                    </div>
                  ))}
                </div>
                {billing && <BillCard billing={billing} offerApplied={offerApplied} />}
                {payMode === 'RAZORPAY' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-ring)', borderRadius: 'var(--radius-sm)', padding: '11px 13px' }}>
                    <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                    <div className="body-xs" style={{ lineHeight: 1.7 }}>Tapping <strong>Pay & Place Order</strong> opens Razorpay. Order is placed only after payment is confirmed.</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <ErrorBanner message={error} onDismiss={() => setError('')} />
      </div>

      {/* Sticky CTA */}
      {!placedOrder && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 'var(--max-w)',
          background: 'var(--tab-bg)', borderTop: '1px solid var(--border)',
          padding: 'var(--sp-12) var(--sp-16)',
          paddingBottom: 'calc(var(--sp-12) + env(safe-area-inset-bottom, 0px))',
        }}>
          <button className="btn btn-primary btn-full btn-lg" disabled={isBusy} onClick={goNext}>
            {btnLabel()}
          </button>
        </div>
      )}
    </div>
  );
}