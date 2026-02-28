import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, CreditCard, Wallet, MapPin, Plus,
  Phone, CheckCircle2, AlertCircle, ChevronRight, Edit2, X,
  RefreshCw, Star, Tag, Percent, Loader, ShieldCheck,
  Info, ChevronDown, ChevronUp, Package, Camera, ImagePlus, Trash2,
  User as UserIcon, Lock,
} from 'lucide-react';
import { ordersAPI, paymentsAPI, addressesAPI, offersAPI, filesAPI, profileAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const ITEM_TYPES      = ['FRAGILE', 'NON_FRAGILE', 'PERISHABLE', 'NON_PERISHABLE', 'ELECTRONICS', 'CLOTHING', 'MEDICAL', 'DOCUMENT', 'FOOD', 'OTHER'];
const ITEM_CATEGORIES = ['DOCUMENT', 'FOOD', 'GROCERY', 'ELECTRONICS', 'CLOTHING', 'MEDICAL', 'PERISHABLE', 'OTHER'];
const ITEM_SIZES      = ['MINI', 'SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'];

const SIZE_WEIGHT = {
  MINI:        '0 - 2 kg',
  SMALL:       '2 - 15 kg',
  MEDIUM:      '15 - 30 kg',
  LARGE:       '30 - 60 kg',
  EXTRA_LARGE: '60 - 120 kg',
};

const STEPS = [
  { label: 'Sender',   icon: '🙋' },
  { label: 'Receiver', icon: '👤' },
  { label: 'Pickup',   icon: '📍' },
  { label: 'Drop',     icon: '🏁' },
  { label: 'Items',    icon: '📦' },
  { label: 'Payment',  icon: '💳' },
  { label: 'Confirm',  icon: '✅' },
];

const EMPTY_ADDR = {
  street: '', city: '', state: '', postalCode: '', country: 'India',
  area: '', buildingOrFlat: '', contactNumber: '', contactPerson: '',
  latitude: null, longitude: null,
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10)                       return '+91' + d;
  if (d.length === 11 && d.startsWith('0'))  return '+91' + d.slice(1);
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
  if (data.error)   return data.error;
  if (Array.isArray(data.errors)) return data.errors.map(x => x.msg || `${x.path}: ${x.msg}`).join(' · ');
  return 'Request failed';
}

/* ─── Step Bar ────────────────────────────────────────────────────────────── */
function StepBar({ step }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'10px 12px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', overflowX:'auto', gap:0, scrollbarWidth:'none' }}>
      {STEPS.map((s, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <React.Fragment key={s.label}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--bg-overlay)',
                color: (done||active) ? '#fff' : 'var(--text-tertiary)',
                fontWeight:700, transition:'all 0.25s',
                boxShadow: active ? '0 0 0 3px var(--accent-ring)' : 'none',
                fontSize: done ? 12 : 11,
              }}>
                {done ? <Check size={12} strokeWidth={3}/> : <span>{s.icon}</span>}
              </div>
              <span style={{
                fontSize:9, fontWeight: active ? 700 : 500,
                color: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--text-tertiary)',
                fontFamily:'var(--font-mono)', letterSpacing:'0.04em', whiteSpace:'nowrap',
              }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex:1, height:2, minWidth:8, maxWidth:24, background: done ? 'var(--green)' : 'var(--border-md)', borderRadius:1, margin:'0 3px', marginBottom:14, transition:'background 0.3s' }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Section Head ────────────────────────────────────────────────────────── */
function SectionHead({ emoji, title, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{emoji}</div>
      <div>
        <div className="label-sm">{title}</div>
        {sub && <div className="body-xs" style={{ color:'var(--text-tertiary)', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Address Tile ────────────────────────────────────────────────────────── */
function AddrTile({ label, addr, dotColor, onEdit }) {
  const summary = addrSummary(addr);
  const isEmpty = !summary;
  return (
    <div onClick={onEdit} style={{ display:'flex', gap:12, alignItems:'flex-start', cursor:'pointer', padding:'12px 14px', background: isEmpty?'var(--bg-elevated)':'var(--bg-surface)', border:`1.5px solid ${isEmpty?'var(--border-md)':'var(--border)'}`, borderRadius:'var(--radius-sm)', transition:'all var(--dur)' }}>
      <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, marginTop:5, background: isEmpty?'var(--border-md)':dotColor, boxShadow: isEmpty?'none':`0 0 0 3px ${dotColor}22` }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', marginBottom:4 }}>{label}</div>
        {isEmpty
          ? <div className="body-sm" style={{ color:'var(--text-tertiary)' }}>Tap to set…</div>
          : <>
              {addr.contactPerson && <div className="body-sm font-semibold">{addr.contactPerson}</div>}
              <div className="body-xs" style={{ marginTop:2, color:'var(--text-secondary)' }}>{summary}</div>
              {addr.contactNumber && <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:3, fontFamily:'var(--font-mono)' }}>{addr.contactNumber}</div>}
              {(!addr.latitude || !addr.longitude) && (
                <div style={{ fontSize:10, color:'var(--orange)', marginTop:4, fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:4 }}>
                  <AlertCircle size={10}/> Coordinates missing — edit to add lat/lng
                </div>
              )}
            </>
        }
      </div>
      <div style={{ padding:'4px 6px', borderRadius:6, background:'var(--bg-overlay)', flexShrink:0 }}>
        <Edit2 size={11} style={{ color:'var(--text-tertiary)', display:'block' }}/>
      </div>
    </div>
  );
}

/* ─── Address Sheet ───────────────────────────────────────────────────────── */
function AddressSheet({ title, savedAddresses, onPick, onManual, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-header">
          <span className="title-sm">{title}</span>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><X size={15}/></button>
        </div>
        <div style={{ overflowY:'auto', paddingBottom:16 }}>
          {savedAddresses.length > 0 && (
            <>
              <div className="label-xs" style={{ padding:'12px 16px 6px' }}>YOUR SAVED ADDRESSES</div>
              {savedAddresses.map(a => (
                <div key={a.id} className="list-item" onClick={() => onPick(a)}>
                  <div className="list-icon" style={{ background:'var(--accent-dim)' }}><MapPin size={15} style={{ color:'var(--accent)' }}/></div>
                  <div className="list-body">
                    <div className="list-title">{a.label||a.contactPerson||a.area||a.city}
                      {a.isPreferredPickup && <span style={{ marginLeft:5, fontSize:9, background:'var(--green-dim)', color:'var(--green)', borderRadius:3, padding:'1px 5px', fontFamily:'var(--font-mono)', fontWeight:700 }}>PICKUP</span>}
                      {a.isPreferredDrop   && <span style={{ marginLeft:5, fontSize:9, background:'var(--blue-dim)', color:'var(--blue)', borderRadius:3, padding:'1px 5px', fontFamily:'var(--font-mono)', fontWeight:700 }}>DROP</span>}
                    </div>
                    <div className="list-subtitle truncate">{addrSummary(a)}</div>
                  </div>
                  <ChevronRight size={14} style={{ color:'var(--text-tertiary)' }}/>
                </div>
              ))}
            </>
          )}
          <div className="list-item" style={{ marginTop:4 }} onClick={onManual}>
            <div className="list-icon" style={{ background:'var(--bg-overlay)' }}><Plus size={15} style={{ color:'var(--text-secondary)' }}/></div>
            <div className="list-body"><div className="list-title">Enter address manually</div><div className="list-subtitle">Type in the full address</div></div>
            <ChevronRight size={14} style={{ color:'var(--text-tertiary)' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Address Form ────────────────────────────────────────────────────────── */
function AddrForm({ addr, onChange, savedAddresses, onPickSaved }) {
  const FULL = [
    { key:'area',           label:'Area / Locality', ph:'Andheri West' },
    { key:'buildingOrFlat', label:'Building / Flat', ph:'A-204, Sunrise Apt' },
    { key:'street',         label:'Street *',        ph:'Link Road' },
  ];
  const HALF = [
    { key:'city',          label:'City *',          ph:'Mumbai' },
    { key:'state',         label:'State',           ph:'Maharashtra' },
    { key:'postalCode',    label:'PIN Code',        ph:'400053' },
    { key:'contactPerson', label:'Contact Person',  ph:'John Doe' },
    { key:'contactNumber', label:'Contact Number',  ph:'+91XXXXXXXXXX' },
  ];
  return (
    <div className="col gap-10">
      {savedAddresses?.length > 0 && <button className="btn btn-secondary" style={{ alignSelf:'flex-start' }} onClick={onPickSaved}><Star size={13}/> Pick from saved</button>}
      {FULL.map(({ key, label, ph }) => (
        <div key={key} className="form-group"><label className="form-label">{label}</label>
          <input className="input" placeholder={ph} value={addr[key]||''} onChange={e => onChange({ ...addr, [key]:e.target.value })}/></div>
      ))}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {HALF.map(({ key, label, ph }) => (
          <div key={key} className="form-group"><label className="form-label">{label}</label>
            <input className="input" placeholder={ph} value={addr[key]||''} onChange={e => onChange({ ...addr, [key]:e.target.value })}/></div>
        ))}
        <div className="form-group"><label className="form-label">Latitude *</label>
          <input className="input" type="number" step="0.000001" placeholder="e.g. 19.0760 (required)"
            value={addr.latitude ?? ''}
            onChange={e => onChange({ ...addr, latitude: e.target.value === '' ? null : +e.target.value })}/></div>
        <div className="form-group"><label className="form-label">Longitude *</label>
          <input className="input" type="number" step="0.000001" placeholder="e.g. 72.8777 (required)"
            value={addr.longitude ?? ''}
            onChange={e => onChange({ ...addr, longitude: e.target.value === '' ? null : +e.target.value })}/></div>
      </div>
    </div>
  );
}

/* ─── Bill Card ───────────────────────────────────────────────────────────── */
function BillCard({ billing: b, offerApplied }) {
  if (!b) return null;
  const rows = [
    { label:'Delivery', val:`₹${Number(b.deliveryCharges).toFixed(2)}`, note:`${Number(b.totalDistance||0).toFixed(1)} km` },
    { label:'Platform Fee', val:`₹${Number(b.platformFee || 0).toFixed(2)}` },
    { label:'Handling', val:`₹${Number(b.handlingCharges || 0).toFixed(2)}` },
    { label:'Subtotal', val:`₹${Number(b.subtotalAmount).toFixed(2)}` },
    { label:`GST ${Number(b.gstPercentage || 0)}%`, val:`₹${Number(b.gstCharges || 0).toFixed(2)}` },
    ...(b.discountAmount > 0 ? [{ label: offerApplied ? offerApplied.code : 'Discount', val:`-₹${Number(b.discountAmount).toFixed(2)}`, green:true, note: offerApplied?.type==='PERCENTAGE' ? `${offerApplied.value}% off${offerApplied.maxDiscount>0?`, max ₹${offerApplied.maxDiscount}`:''}` : `Flat ₹${offerApplied?.value} off` }] : []),
  ];
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
      <div style={{ padding:'8px 14px', background:'var(--bg-overlay)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', fontFamily:'var(--font-mono)', color:'var(--text-secondary)' }}>BILL SUMMARY</span>
      </div>
      <div style={{ padding:'6px 14px', background:'var(--bg-surface)' }}>
        {rows.map(({ label, val, green, note }) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
            <div>
              <span className="body-xs" style={{ color:green?'var(--green)':'var(--text-secondary)' }}>{label}</span>
              {note && <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:1 }}>{note}</div>}
            </div>
            <span className="body-xs font-semibold" style={{ color:green?'var(--green)':'var(--text-primary)', fontFamily:'var(--font-mono)' }}>{val}</span>
          </div>
        ))}
      </div>
      <div style={{ padding:'10px 14px', background:'var(--accent-dim)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span className="body-sm font-semibold">Total Payable</span>
        <span style={{ fontSize:22, fontWeight:800, color:'var(--accent)', fontFamily:'var(--font-mono)' }}>₹{Number(b.payableAmount).toFixed(2)}</span>
      </div>
    </div>
  );
}

/* ─── SIZE BADGE ─────────────────────────────────────────────────────────── */
const SIZE_COLOR = {
  MINI: '#64748b', SMALL: '#0ea5e9', MEDIUM: '#8b5cf6',
  LARGE: '#f59e0b', EXTRA_LARGE: '#ef4444',
};

/* ─── Item Card (collapsible) ────────────────────────────────────────────── */
function ItemCard({ item, idx, expanded, onToggle, onChange, onDelete, canDelete, uploadingImg, onUpload, onRemoveImage }) {
  const hasName   = !!item.name.trim();
  const sizeColor = SIZE_COLOR[item.size] || 'var(--accent)';

  return (
    <div style={{
      border: `1.5px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      marginBottom: 10,
    }}>
      {/* ── Summary Row (always visible) ── */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', cursor: 'pointer',
          background: expanded ? 'var(--accent-dim)' : 'var(--bg-surface)',
          transition: 'background 0.2s',
          userSelect: 'none',
        }}
      >
        {/* Index badge */}
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: expanded ? 'var(--accent)' : 'var(--bg-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}>
          {hasName && !expanded
            ? <Check size={12} strokeWidth={3} style={{ color: expanded ? '#fff' : 'var(--green)' }}/>
            : <Package size={12} style={{ color: expanded ? '#fff' : 'var(--text-tertiary)' }}/>
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.name}
              </span>
              {item.quantity > 1 && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                  ×{item.quantity}
                </span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: sizeColor + '18', color: sizeColor,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
              }}>
                {item.size}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: 'var(--bg-overlay)', color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {item.category}
              </span>
              {(item.images || []).length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Camera size={9}/> {item.images.length}
                </span>
              )}
            </div>
          ) : (
            <span className="body-sm" style={{ color: 'var(--text-tertiary)' }}>Item {idx + 1} — fill in details</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', padding: 0 }}
            >
              <Trash2 size={13}/>
            </button>
          )}
          <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
            {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </div>
        </div>
      </div>

      {/* ── Expanded Form ── */}
      {expanded && (
        <div style={{ padding: '14px 14px 16px', borderTop: '1px solid var(--border)' }}>
          <div className="col gap-10">
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input
                className="input" placeholder="e.g. Documents"
                value={item.name}
                onChange={e => onChange({ ...item, name: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key:'quantity', label:'Quantity', type:'number', min:1 },
                { key:'size',     label:'Size',     type:'select', opts:ITEM_SIZES, hint: SIZE_WEIGHT },
                { key:'type',     label:'Type',     type:'select', opts:ITEM_TYPES },
                { key:'category', label:'Category', type:'select', opts:ITEM_CATEGORIES },
              ].map(({ key, label, type, opts, min, hint }) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  {type === 'select'
                    ? <select className="input" value={item[key]} onChange={e => onChange({ ...item, [key]: e.target.value })}>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    : <input className="input" type={type} min={min} value={item[key]} onChange={e => onChange({ ...item, [key]: +e.target.value })}/>
                  }
                  {hint && hint[item[key]] && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {hint[item[key]]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Item Images */}
            <div className="form-group">
              <label className="form-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Camera size={12}/> Item Photos
                <span style={{ color:'var(--text-tertiary)', fontWeight:400 }}>(optional)</span>
              </label>
              {(item.images || []).length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                  {(item.images || []).map((url, imgIdx) => (
                    <div key={imgIdx} style={{ position:'relative', width:64, height:64, borderRadius:8, overflow:'hidden', border:'1.5px solid var(--border)', flexShrink:0 }}>
                      <img src={url} alt={`item-${idx}-img-${imgIdx}`} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      <button
                        onClick={() => onRemoveImage(imgIdx)}
                        style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.65)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}
                      >
                        <X size={10} style={{ color:'#fff' }}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'9px 12px', border:'1.5px dashed var(--border-md)', borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', opacity: uploadingImg ? 0.6 : 1, pointerEvents: uploadingImg ? 'none' : 'auto' }}>
                <input
                  type="file" accept="image/jpeg,image/png,image/jpg" multiple style={{ display:'none' }}
                  onChange={onUpload}
                />
                {uploadingImg
                  ? <><div className="spinner" style={{ width:13, height:13, borderWidth:2 }}/><span className="body-xs" style={{ color:'var(--text-secondary)' }}>Uploading…</span></>
                  : <><ImagePlus size={13} style={{ color:'var(--accent)' }}/><span className="body-xs" style={{ color:'var(--text-secondary)' }}>Add photos <span style={{ color:'var(--text-tertiary)' }}>· JPG, PNG · max 10MB each</span></span></>
                }
              </label>
            </div>

            {/* Done button */}
            <button
              className="btn btn-ghost btn-sm"
              style={{ alignSelf:'flex-start' }}
              onClick={onToggle}
            >
              <Check size={12}/> Done editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function PlaceOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  /* ── STEP 0 — SENDER ── */
  const [senderFirstName, setSenderFirstName] = useState('');
  const [senderLastName,  setSenderLastName]  = useState('');
  const [senderPhone,     setSenderPhone]     = useState('');
  const [senderLoading,   setSenderLoading]   = useState(true);
  const [senderSaved,     setSenderSaved]     = useState(false);

  /* ── STEP 1 — RECEIVER ── */
  const [rawPhone,      setRawPhone]      = useState('');
  const [firstName,     setFirstName]     = useState('');
  const [lastName,      setLastName]      = useState('');
  const [lookingUp,     setLookingUp]     = useState(false);
  const [lookupDone,    setLookupDone]    = useState(false);
  const [receiverFound, setReceiverFound] = useState(false);
  const [lookupError,   setLookupError]   = useState('');

  /* ── STEP 2 — PICKUP ── */
  const [pickup,          setPickup]          = useState({ ...EMPTY_ADDR });
  const [pickupSource,    setPickupSource]    = useState('');
  const [editingPickup,   setEditingPickup]   = useState(false);
  const [showPickupSheet, setShowPickupSheet] = useState(false);

  /* ── STEP 3 — DROP ── */
  const [drop,          setDrop]          = useState({ ...EMPTY_ADDR });
  const [dropSource,    setDropSource]    = useState('');
  const [editingDrop,   setEditingDrop]   = useState(false);
  const [showDropSheet, setShowDropSheet] = useState(false);

  const [myAddrs,       setMyAddrs]       = useState([]);
  const [availability,  setAvailability]  = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);

  /* ── STEP 4 — ITEMS ── */
  const [items,          setItems]          = useState([{ name:'', quantity:1, type:'DOCUMENT', category:'OTHER', size:'SMALL', images:[] }]);
  const [expandedItem,   setExpandedItem]   = useState(0);   // which item card is open
  const [uploadingImg,   setUploadingImg]   = useState({});
  const [preparingDraft, setPreparingDraft] = useState(false);

  /* ── STEP 5 — PAYMENT ── */
  const [draftOrder,     setDraftOrder]     = useState(null);
  const [billing,        setBilling]        = useState(null);
  const [isSelfHandling, setIsSelfHandling] = useState(false);
  const [offerCode,      setOfferCode]      = useState('');
  const [offerApplied,   setOfferApplied]   = useState(null);
  const [offerError,     setOfferError]     = useState('');
  const [applyingOffer,  setApplyingOffer]  = useState(false);
  const [removingOffer,      setRemovingOffer]      = useState(false);
  const [recalculating,      setRecalculating]      = useState(false);
  const [activeOffers,   setActiveOffers]   = useState([]);
  const [showOffers,     setShowOffers]     = useState(false);
  const [payMode,        setPayMode]        = useState('RAZORPAY');

  const [loading,     setLoading]     = useState(false);
  const [payLoading,  setPayLoading]  = useState(false);
  const [error,       setError]       = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);

  /* ─── Init ─── */
  useEffect(() => {
    if (user) {
      setSenderFirstName(user.firstName || '');
      setSenderLastName(user.lastName   || '');
      setSenderPhone(user.phoneNumber   || '');
      if (user.firstName) setSenderSaved(true);
    }
    profileAPI.getMe()
      .then(({ data }) => {
        const u = data.data || data;
        setSenderFirstName(u.firstName || '');
        setSenderLastName(u.lastName   || '');
        setSenderPhone(u.phoneNumber   || '');
        if (u.firstName) setSenderSaved(true);
      })
      .catch(() => {})
      .finally(() => setSenderLoading(false));

    addressesAPI.getAll().then(({ data }) => {
      const addrs = data.data || [];
      setMyAddrs(addrs);
      const pref = addrs.find(a => a.isPreferredPickup);
      if (pref) { setPickup(addrFromSaved(pref)); setPickupSource('preferred'); }
    }).catch(() => {});

    if (!window.Razorpay) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.head.appendChild(s);
    }
  }, []);

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
        if (!lastName.trim()  && info.lastName)  setLastName(info.lastName);
        if (info.preferredDropAddress) {
          const a = addrFromPersisted(info.preferredDropAddress);
          if (!a.contactPerson) a.contactPerson = info.firstName || '';
          if (!a.contactNumber) a.contactNumber = phone;
          setDrop(a); setDropSource('receiver');
        } else { setDrop({ ...EMPTY_ADDR }); setDropSource(''); }
      } else { setReceiverFound(false); setDrop({ ...EMPTY_ADDR }); setDropSource(''); }
    } catch { setLookupError('Could not look up this number. Try again.'); }
    finally { setLookingUp(false); }
  }, [rawPhone, firstName, lastName]);

  /* ─── Auto re-prepare draft when returning to step 5 with no billing ─── */
  useEffect(() => {
    // When user navigates back to step 5 (billing cleared by goBack),
    // automatically re-run prepareDraft so billing + toggle stay in sync.
    if (step === 4) return; // prepareDraft is triggered manually from goNext
    if (step === 5 && !billing && !preparingDraft) {
      prepareDraft();
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Offers ─── */
  useEffect(() => {
    if (step !== 5) return;
    const amount = billing?.payableAmount || 0;
    offersAPI.getAll(amount)
      .then(({ data }) => setActiveOffers(data.data || []))
      .catch(() => {});
  }, [step, billing?.payableAmount]);

  /* ─── Auto-check availability ─── */
  useEffect(() => {
    if (step === 3 && pickup.latitude && pickup.longitude && drop.latitude && drop.longitude) checkAvail();
  }, [step, pickup.latitude, pickup.longitude, drop.latitude, drop.longitude]);

  const checkAvail = useCallback(async () => {
    if (!pickup.latitude || !drop.latitude) return;
    setAvailability(null); setCheckingAvail(true);
    try {
      const { data } = await ordersAPI.checkAvailability({ pickupLat:pickup.latitude, pickupLng:pickup.longitude, dropLat:drop.latitude, dropLng:drop.longitude });
      setAvailability(data.data || data);
    } catch { setAvailability(null); }
    finally { setCheckingAvail(false); }
  }, [pickup, drop]);

  /* ─── Item helpers ─── */
  const updateItem = (idx, updated) => {
    const n = [...items];
    n[idx] = updated;
    setItems(n);
  };

  const deleteItem = (idx) => {
    const n = items.filter((_, i) => i !== idx);
    setItems(n);
    // adjust expanded index
    setExpandedItem(prev => {
      if (prev === idx) return Math.max(0, idx - 1);
      if (prev > idx)   return prev - 1;
      return prev;
    });
  };

  const addItem = () => {
    const newIdx = items.length;
    setItems([...items, { name:'', quantity:1, type:'DOCUMENT', category:'OTHER', size:'SMALL', images:[] }]);
    setExpandedItem(newIdx); // open the new one, collapse all others
  };

  const handleImageUpload = async (idx, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImg(u => ({ ...u, [idx]: true }));
    try {
      const uploaded = await Promise.all(files.map(f => filesAPI.upload(f).then(r => r.data.data.url)));
      updateItem(idx, { ...items[idx], images: [...(items[idx].images || []), ...uploaded] });
    } catch { setError('Image upload failed.'); }
    finally { setUploadingImg(u => ({ ...u, [idx]: false })); e.target.value = ''; }
  };

  const buildPayload = () => ({
    receiverPhone:     normalizePhone(rawPhone) || rawPhone,
    receiverFirstName: firstName.trim(),
    receiverLastName:  lastName.trim(),
    pickup:  sanitizeAddr(pickup),
    drop:    sanitizeAddr(drop),
    items,
    paymentMode: payMode === 'RAZORPAY' ? 'UPI' : payMode,
    isSelfHandling,
  });

  /* ─── Step 4→5: Create draft ─── */
  const prepareDraft = async () => {
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
      setStep(5);
    } catch (e) {
      setError(extractApiError(e));
    } finally { setPreparingDraft(false); }
  };

  /* ─── Apply offer ─── */
  const handleApplyOffer = async (codeOverride) => {
    const code = (codeOverride || offerCode).trim().toUpperCase();
    if (!code) { setOfferError('Enter an offer code'); return; }
    if (!draftOrder) { setOfferError('Draft not ready — go back and re-confirm your items'); return; }
    setApplyingOffer(true); setOfferError(''); setOfferCode(code);
    try {
      const { data } = await ordersAPI.applyOffer(draftOrder.orderId, code);
      const updated = data.data || data;
      setDraftOrder(updated); setBilling(updated.billing);
      const found = activeOffers.find(o => o.offerCode === code);
      setOfferApplied({ code, name:found?.offerName??code, type:found?.offerType??'FLAT', value:found?.discountValue??0, maxDiscount:found?.maxDiscountAmount??0, minOrder:found?.minOrderAmount??0 });
      setShowOffers(false);
    } catch (e) {
      console.error('[applyOffer] failed:', e?.response?.data || e?.message || e);
      setOfferError(extractApiError(e));
    } finally { setApplyingOffer(false); }
  };

  /* ─── Remove offer ─── */
  const handleRemoveOffer = async () => {
    if (!draftOrder) return;
    setRemovingOffer(true);
    try {
      const { data } = await ordersAPI.prepare(buildPayload());
      const updated = data.data || data;
      setDraftOrder(updated); setBilling(updated.billing);
      setOfferApplied(null); setOfferCode(''); setOfferError('');
    } catch (_) {}
    finally { setRemovingOffer(false); }
  };

  /* ─── Recalculate billing (e.g. after toggling self-handling) ─── */
  const recalculateBilling = async (newSelfHandling) => {
    if (!draftOrder) return;
    setRecalculating(true);
    try {
      const payload = { ...buildPayload(), isSelfHandling: newSelfHandling };
      const { data } = await ordersAPI.prepare(payload);
      const updated = data.data || data;
      setDraftOrder(updated);
      setBilling(updated.billing);
      // Re-apply offer if one was applied
      if (offerApplied) {
        try {
          const { data: od } = await ordersAPI.applyOffer(updated.orderId, offerApplied.code);
          const withOffer = od.data || od;
          setDraftOrder(withOffer);
          setBilling(withOffer.billing);
        } catch (_) {}
      }
    } catch (_) {}
    finally { setRecalculating(false); }
  };

  /* ─── Place COD ─── */
  const placeOrderCOD = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await ordersAPI.placeDraft(draftOrder.orderId, { offerCode:offerApplied?.code, isSelfHandling, paymentMode:'COD' });
      setPlacedOrder(data.data || data);
    } catch (e) { setError(extractApiError(e)); }
    finally { setLoading(false); }
  };

  /* ─── Place Online ─── */
  const placeOrderOnline = async () => {
    setPayLoading(true); setError('');
    try {
      const amount = billing?.payableAmount || 1;
      const { data: pd } = await paymentsAPI.initiate({
        orderId: draftOrder.orderId, amount,
        customerName:  `${user?.firstName||''} ${user?.lastName||''}`.trim()||'Customer',
        customerPhone: user?.phoneNumber||'', customerEmail: user?.email||'',
      });
      const payData = pd.data || pd;
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: Math.round(amount * 100), currency:'INR',
          order_id: payData.gatewayOrderId,
          name:'Bhada Delivery', description:`Order #${draftOrder.orderId?.slice(-8)}`,
          prefill: { name:`${user?.firstName||''} ${user?.lastName||''}`.trim(), contact:user?.phoneNumber||'', email:user?.email||'' },
          theme: { color:'#4F6EF7' },
          handler: async (resp) => {
            try {
              await paymentsAPI.verify(payData.paymentId, { razorpayPaymentId:resp.razorpay_payment_id, razorpaySignature:resp.razorpay_signature, orderId:draftOrder.orderId });
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
    } finally { setPayLoading(false); }
  };

  /* ─── Navigation ─── */
  const goNext = async () => {
    setError('');
    if (step === 0) {
      if (!senderFirstName.trim()) { setError('Enter your first name'); return; }
    }
    if (step === 1) {
      if (rawPhone.length !== 10)  { setError('Enter a 10-digit mobile number'); return; }
      if (!lookupDone)             { setError('Tap "Look up" to check the receiver first'); return; }
      if (!firstName.trim())       { setError("Enter the receiver's first name"); return; }
    }
    if (step === 2) {
      if (!pickup.street || !pickup.city)       { setError('Fill in pickup street and city'); return; }
      if (!pickup.latitude || !pickup.longitude) { setError('Pickup address is missing coordinates.'); return; }
    }
    if (step === 3) {
      if (!drop.street || !drop.city) { setError('Fill in drop street and city'); return; }
      if (pickup.latitude == null || pickup.longitude == null || drop.latitude == null || drop.longitude == null) {
        setError('Both addresses must have coordinates'); return;
      }
      if (!pickup.latitude || !pickup.longitude || !drop.latitude || !drop.longitude) {
        setError('Coordinates cannot be zero.'); return;
      }
      if (checkingAvail) { setError('Checking availability, please wait…'); return; }
      if (!availability) { await checkAvail(); return; }
      if (!availability.available) { setError('Service not available for this route.'); return; }
    }
    if (step === 4) {
      if (items.some(i => !i.name.trim())) { setError('All items need a name'); return; }
      // Clear any previous billing/draft so step-5 useEffect triggers fresh prepareDraft
      setBilling(null);
      setDraftOrder(null);
      setOfferApplied(null);
      setOfferCode('');
      setStep(5);
      return;
    }
    if (step === 5) { setStep(6); return; }
    if (step === 6) {
      if (placedOrder) { navigate(`/orders/${placedOrder.orderId}`, { replace:true }); return; }
      if (payMode === 'RAZORPAY') await placeOrderOnline();
      else await placeOrderCOD();
      return;
    }
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const goBack = () => { 
    setError(''); 
    if (step === 5) {
      // Clear stale billing/draft so useEffect on step===5 triggers fresh prepareDraft.
      // isSelfHandling is intentionally NOT reset — preserves user's toggle choice.
      setBilling(null);
      setDraftOrder(null);
      setOfferApplied(null);
      setOfferCode('');
    }
    if (step > 0) setStep(s => s - 1); else navigate(-1); 
  };
  const applyToPickup = (saved) => { setPickup(addrFromSaved(saved)); setPickupSource('saved'); setAvailability(null); setEditingPickup(false); setShowPickupSheet(false); };
  const applyToDrop   = (saved) => { setDrop(addrFromSaved(saved)); setDropSource('sender'); setAvailability(null); setEditingDrop(false); setShowDropSheet(false); };

  const pickupReady = !!(pickup.street && pickup.city);
  const dropReady   = !!(drop.street && drop.city);
  const isBusy      = loading || payLoading || preparingDraft;

  const btnLabel = () => {
    if (isBusy) return <><div className="spinner" style={{ width:16, height:16, borderWidth:2, borderTopColor:'#fff' }}/> Processing…</>;
    if (step === 4) return '→ Calculate & Continue';
    if (step === 5) return '→ Review Order';
    if (step === 6) {
      if (placedOrder) return 'Track Order';
      return payMode === 'RAZORPAY' ? '💳 Pay & Place Order' : '✓ Place Order (COD)';
    }
    return 'Continue →';
  };

  /* ─── RENDER ─── */
  return (
    <div style={{ background:'var(--bg-base)', minHeight:'100vh' }}>

      {showPickupSheet && <AddressSheet title="Pickup Address" savedAddresses={myAddrs} onPick={applyToPickup} onManual={() => { setShowPickupSheet(false); setEditingPickup(true); }} onClose={() => setShowPickupSheet(false)}/>}
      {showDropSheet   && <AddressSheet title="Drop Address"   savedAddresses={myAddrs} onPick={applyToDrop}   onManual={() => { setShowDropSheet(false);   setEditingDrop(true);   }} onClose={() => setShowDropSheet(false)}/>}

      {/* Header */}
      <div className="page-header" style={{ top:0, zIndex:20 }}>
        <button className="btn btn-ghost btn-icon-sm" onClick={goBack}><ArrowLeft size={16}/></button>
        <div>
          <div className="page-title">New Order</div>
          <div className="page-subtitle">Step {step+1} of {STEPS.length} · {STEPS[step].label}</div>
        </div>
      </div>

      <StepBar step={step}/>

      <div style={{ padding:'16px', paddingBottom:100 }}>

        {/* ══ STEP 0 — SENDER ══ */}
        {step === 0 && (
          <div className="col gap-12">
            <div className="card">
              <SectionHead emoji="🙋" title="Your Details" sub="Confirm your sender info before placing the order"/>
              <div className="form-group" style={{ marginBottom:14 }}>
                <label className="form-label" style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <Phone size={11}/> Your Mobile Number
                  <span style={{ marginLeft:4, display:'flex', alignItems:'center', gap:3, fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-mono)' }}>
                    <Lock size={9}/> not editable
                  </span>
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    className="input"
                    value={senderPhone ? `+91 ${senderPhone.replace(/^\+91/, '').replace(/^\91/, '')}` : '—'}
                    readOnly
                    style={{ background:'var(--bg-overlay)', color:'var(--text-tertiary)', cursor:'not-allowed', paddingRight:36 }}
                  />
                  <Lock size={13} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-tertiary)', pointerEvents:'none' }}/>
                </div>
                <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:4, fontFamily:'var(--font-mono)' }}>
                  Registered number from your account — cannot be changed here
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="input" placeholder="Rahul" value={senderFirstName} onChange={e => setSenderFirstName(e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="input" placeholder="Sharma" value={senderLastName} onChange={e => setSenderLastName(e.target.value)}/>
                </div>
              </div>
              {senderLoading && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, color:'var(--text-tertiary)', fontSize:11 }}>
                  <div className="spinner" style={{ width:11, height:11, borderWidth:2 }}/> Loading your profile…
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:10, background:'var(--accent-dim)', border:'1px solid var(--accent-ring)', borderRadius:'var(--radius-sm)', padding:'11px 13px' }}>
              <Info size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:1 }}/>
              <div className="body-xs" style={{ lineHeight:1.7 }}>
                Your phone number is linked to your account and is used to track this order. You can update your display name here — it won't affect your account profile.
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 1 — RECEIVER ══ */}
        {step === 1 && (
          <div className="col gap-12">
            <div className="card">
              <SectionHead emoji="👤" title="Who is receiving this?"/>
              <div className="form-group" style={{ marginBottom:12 }}>
                <label className="form-label">Receiver's Mobile Number</label>
                <div className="row gap-8">
                  <div style={{ position:'relative', flex:1 }}>
                    <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, fontWeight:600, color:'var(--text-secondary)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>+91</span>
                    <input className="input" type="tel" inputMode="numeric" placeholder="98765 43210" style={{ paddingLeft:44 }}
                      value={rawPhone}
                      onChange={e => { const v=e.target.value.replace(/\D/g,'').slice(0,10); setRawPhone(v); if(v!==rawPhone){setLookupDone(false);setReceiverFound(false);setLookupError('');setDropSource('');setDrop({...EMPTY_ADDR});} }}
                      onKeyDown={e => { if(e.key==='Enter'&&rawPhone.length===10) lookupReceiver(); }}/>
                  </div>
                  <button className="btn btn-primary" style={{ flexShrink:0, minWidth:82 }} disabled={rawPhone.length!==10||lookingUp} onClick={lookupReceiver}>
                    {lookingUp ? <div className="spinner" style={{ width:14,height:14,borderWidth:2,borderTopColor:'#fff' }}/> : lookupDone ? <><RefreshCw size={13}/> Re-check</> : 'Look up'}
                  </button>
                </div>
              </div>
              {lookupDone && receiverFound && (
                <div style={{ display:'flex', gap:10, background:'var(--green-dim)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:12 }}>
                  <CheckCircle2 size={15} style={{ color:'var(--green)', flexShrink:0, marginTop:1 }}/>
                  <div>
                    <div className="body-sm font-semibold" style={{ color:'var(--green)' }}>Receiver found</div>
                    <div className="body-xs" style={{ marginTop:2 }}>{dropSource==='receiver'?'✓ Preferred drop address loaded.':'No preferred drop — enter in Drop step.'}</div>
                  </div>
                </div>
              )}
              {lookupDone && !receiverFound && (
                <div style={{ display:'flex', gap:10, background:'rgba(234,88,12,0.08)', border:'1px solid rgba(234,88,12,0.2)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:12 }}>
                  <AlertCircle size={15} style={{ color:'var(--orange)', flexShrink:0, marginTop:1 }}/>
                  <div>
                    <div className="body-sm font-semibold" style={{ color:'var(--orange)' }}>New receiver</div>
                    <div className="body-xs" style={{ marginTop:2 }}>Not registered — you can still place the order.</div>
                  </div>
                </div>
              )}
              {lookupError && <div className="alert alert-error" style={{ marginBottom:12 }}><AlertCircle size={14}/> {lookupError}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group"><label className="form-label">First Name *</label><input className="input" placeholder="Rahul" value={firstName} onChange={e => setFirstName(e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Last Name</label><input className="input" placeholder="Sharma" value={lastName} onChange={e => setLastName(e.target.value)}/></div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, background:'var(--accent-dim)', border:'1px solid var(--accent-ring)', borderRadius:'var(--radius-sm)', padding:'11px 13px' }}>
              <Phone size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:1 }}/>
              <div className="body-xs" style={{ lineHeight:1.7 }}>Enter the receiver's number and tap <strong>Look up</strong>. Preferred drop address will be auto-filled if available.</div>
            </div>
          </div>
        )}

        {/* ══ STEP 2 — PICKUP ══ */}
        {step === 2 && (
          <div className="col gap-12">
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📍</div>
                <div>
                  <div className="label-sm">Pickup Address</div>
                  {pickupSource === 'preferred' && <div style={{ fontSize:10, color:'var(--green)', fontFamily:'var(--font-mono)', fontWeight:700, marginTop:2, display:'flex', alignItems:'center', gap:4 }}><CheckCircle2 size={10}/> YOUR PREFERRED PICKUP ADDRESS</div>}
                  {pickupSource === 'saved'     && <div style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', fontWeight:700, marginTop:2 }}>FROM YOUR SAVED ADDRESSES</div>}
                  {!pickupSource && !pickupReady && <div className="body-xs" style={{ color:'var(--text-tertiary)', marginTop:2 }}>Where to collect the parcel from</div>}
                </div>
              </div>
              {!editingPickup ? (
                pickupReady ? (
                  <div className="col gap-8">
                    <AddrTile label="PICKUP" addr={pickup} dotColor="var(--green)" onEdit={() => setEditingPickup(true)}/>
                    <div className="row gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingPickup(true)}><Edit2 size={11}/> Edit</button>
                      {myAddrs.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setShowPickupSheet(true)}><RefreshCw size={11}/> Change</button>}
                    </div>
                  </div>
                ) : (
                  <div className="col gap-8">
                    {myAddrs.length > 0 && <button className="btn btn-secondary btn-full" onClick={() => setShowPickupSheet(true)}><Star size={14}/> Choose from saved addresses</button>}
                    <button className="btn btn-ghost btn-full" onClick={() => setEditingPickup(true)}><Plus size={14}/> Enter manually</button>
                  </div>
                )
              ) : (
                <div className="col gap-10">
                  <AddrForm addr={pickup} onChange={a => { setPickup(a); setPickupSource('manual'); }} savedAddresses={myAddrs} onPickSaved={() => setShowPickupSheet(true)}/>
                  {pickupReady && <button className="btn btn-ghost btn-sm" style={{ alignSelf:'flex-start' }} onClick={() => setEditingPickup(false)}><Check size={12}/> Done</button>}
                </div>
              )}
            </div>
            {pickupSource === 'preferred' && !editingPickup && pickupReady && (
              <div style={{ display:'flex', gap:10, background:'var(--green-dim)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:'var(--radius-sm)', padding:'11px 13px' }}>
                <Star size={14} style={{ color:'var(--green)', flexShrink:0, marginTop:1 }}/>
                <div className="body-xs" style={{ lineHeight:1.7 }}>This is your <strong>preferred pickup address</strong>. It was auto-selected for you. Tap <strong>Change</strong> to use a different address.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 3 — DROP ══ */}
        {step === 3 && (
          <div className="col gap-12">
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🏁</div>
                <div>
                  <div className="label-sm">Drop Address</div>
                  {dropSource==='receiver' && <div style={{ fontSize:10, color:'var(--accent)', fontFamily:'var(--font-mono)', fontWeight:700, marginTop:2 }}>✓ RECEIVER'S PREFERRED DROP</div>}
                  {dropSource==='sender'   && <div style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', fontWeight:700, marginTop:2 }}>FROM YOUR SAVED ADDRESSES</div>}
                  {!dropSource && !dropReady && <div className="body-xs" style={{ color:'var(--text-tertiary)', marginTop:2 }}>{receiverFound?'No preferred drop — set one below.':'Enter the drop address.'}</div>}
                </div>
              </div>
              {!editingDrop ? (
                dropReady ? (
                  <div className="col gap-8">
                    <AddrTile label="DROP" addr={drop} dotColor="var(--red)" onEdit={() => setEditingDrop(true)}/>
                    <div className="row gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingDrop(true)}><Edit2 size={11}/> Edit</button>
                      {myAddrs.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setShowDropSheet(true)}><RefreshCw size={11}/> Change</button>}
                    </div>
                  </div>
                ) : (
                  <div className="col gap-8">
                    {myAddrs.length > 0 && <button className="btn btn-secondary btn-full" onClick={() => setShowDropSheet(true)}><Star size={14}/> Choose from saved addresses</button>}
                    <button className="btn btn-ghost btn-full" onClick={() => setEditingDrop(true)}><Plus size={14}/> Enter manually</button>
                  </div>
                )
              ) : (
                <div className="col gap-10">
                  <AddrForm addr={drop} onChange={a => { setDrop(a); if(!dropSource) setDropSource('manual'); }} savedAddresses={myAddrs} onPickSaved={() => setShowDropSheet(true)}/>
                  {dropReady && <button className="btn btn-ghost btn-sm" style={{ alignSelf:'flex-start' }} onClick={() => setEditingDrop(false)}><Check size={12}/> Done</button>}
                </div>
              )}
            </div>
            {checkingAvail && (
              <div className="row gap-8" style={{ justifyContent:'center', color:'var(--text-tertiary)', padding:'8px 0' }}>
                <div className="spinner" style={{ width:14, height:14, borderWidth:2 }}/>
                <span style={{ fontSize:13 }}>Checking availability…</span>
              </div>
            )}
            {availability && (
              <div className={`alert alert-${availability.available?'success':'error'}`}>
                <div>
                  <div className="body-sm font-semibold">{availability.available?'✓ Service available':'✗ Service not available'}</div>
                  {availability.message && <div style={{ marginTop:3, fontSize:12 }}>{availability.message}</div>}
                  {availability.estimatedFare && <div style={{ marginTop:8, fontWeight:600, fontSize:13 }}>Estimated: <span style={{ color:'var(--accent)', fontFamily:'var(--font-mono)' }}>₹{availability.estimatedFare}</span> · {availability.estimatedDistance} km</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 4 — ITEMS ══ */}
        {step === 4 && (
          <>
            {/* Items count header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Package size={14} style={{ color:'var(--accent)' }}/>
                </div>
                <div>
                  <div className="label-sm" style={{ marginBottom:0 }}>Items</div>
                  <div style={{ fontSize:10, color:'var(--text-tertiary)', fontFamily:'var(--font-mono)' }}>
                    {items.length} item{items.length !== 1 ? 's' : ''} · tap to expand
                  </div>
                </div>
              </div>
              {/* All-collapse toggle — useful when many items */}
              {items.length > 1 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize:11 }}
                  onClick={() => setExpandedItem(expandedItem === null ? 0 : null)}
                >
                  {expandedItem === null ? <><ChevronDown size={11}/> Expand</> : <><ChevronUp size={11}/> Collapse all</>}
                </button>
              )}
            </div>

            {/* Item cards */}
            {items.map((item, idx) => (
              <ItemCard
                key={idx}
                item={item}
                idx={idx}
                expanded={expandedItem === idx}
                onToggle={() => setExpandedItem(expandedItem === idx ? null : idx)}
                onChange={updated => updateItem(idx, updated)}
                onDelete={() => deleteItem(idx)}
                canDelete={items.length > 1}
                uploadingImg={!!uploadingImg[idx]}
                onUpload={e => handleImageUpload(idx, e)}
                onRemoveImage={imgIdx => updateItem(idx, { ...item, images: item.images.filter((_, i) => i !== imgIdx) })}
              />
            ))}

            {/* Add item button */}
            <button
              className="btn btn-secondary btn-full"
              onClick={addItem}
              style={{ marginTop: 4 }}
            >
              <Plus size={14}/> Add Another Item
            </button>

            <div style={{ display:'flex', gap:10, marginTop:12, background:'var(--accent-dim)', border:'1px solid var(--accent-ring)', borderRadius:'var(--radius-sm)', padding:'11px 13px' }}>
              <Info size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:1 }}/>
              <div className="body-xs" style={{ lineHeight:1.7 }}>
                Item size is based on <strong>weight</strong>: Mini (0–2 kg), Small (2–15 kg), Medium (15–30 kg), Large (30–60 kg), Extra Large (60–120 kg).
                The exact bill is calculated when you tap Continue.
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 5 — PAYMENT ══ */}
        {step === 5 && (
          <div className="col gap-12">
            {recalculating ? (
              <div className="card" style={{ textAlign:'center', padding:28, color:'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width:20, height:20, borderWidth:2, margin:'0 auto 8px' }}/>
                <div className="body-xs">Recalculating…</div>
              </div>
            ) : billing
              ? <BillCard billing={billing} offerApplied={offerApplied}/>
              : (
              <div className="card" style={{ textAlign:'center', padding:28, color:'var(--text-tertiary)' }}>
                <div className="spinner" style={{ width:20, height:20, borderWidth:2, margin:'0 auto 8px' }}/>
                <div className="body-xs">Loading billing…</div>
              </div>
            )
            }
            {/* Items Breakdown */}
            {(() => {
              // Group items by size and count quantities
              const sizeOrder = ['MINI', 'SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'];
              const sizeLabel = { MINI:'Mini', SMALL:'Small', MEDIUM:'Medium', LARGE:'Large', EXTRA_LARGE:'Extra Large' };
              const sizeWeight = { MINI:'0–2 kg', SMALL:'2–15 kg', MEDIUM:'15–30 kg', LARGE:'30–60 kg', EXTRA_LARGE:'60–120 kg' };
              const grouped = items.reduce((acc, item) => {
                const s = item.size || 'SMALL';
                if (!acc[s]) acc[s] = { count: 0, names: [] };
                acc[s].count += (item.quantity || 1);
                if (item.name.trim()) acc[s].names.push(item.name.trim());
                return acc;
              }, {});
              const rows = sizeOrder.filter(s => grouped[s]);
              return (
                <div className="card">
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <Package size={14} style={{ color:'var(--accent)' }}/>
                    <span className="label-sm">Items ({items.reduce((t, i) => t + (i.quantity || 1), 0)} total)</span>
                  </div>
                  {rows.map((size, idx) => {
                    const g = grouped[size];
                    const colors = { MINI:'#64748b', SMALL:'#0ea5e9', MEDIUM:'#8b5cf6', LARGE:'#f59e0b', EXTRA_LARGE:'#ef4444' };
                    const c = colors[size];
                    return (
                      <div key={size} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        {/* Size badge */}
                        <div style={{ width:36, height:36, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: c + '15' }}>
                          <span style={{ fontSize:11, fontWeight:800, color:c, fontFamily:'var(--font-mono)' }}>
                            {size === 'EXTRA_LARGE' ? 'XL' : size[0]}
                          </span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{sizeLabel[size]}</span>
                            <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:4, background: c + '18', color:c, fontFamily:'var(--font-mono)', letterSpacing:'0.04em' }}>{sizeWeight[size]}</span>
                          </div>
                          {g.names.length > 0 && (
                            <div className="body-xs" style={{ color:'var(--text-tertiary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {g.names.join(', ')}
                            </div>
                          )}
                        </div>
                        {/* Quantity pill */}
                        <div style={{ flexShrink:0, minWidth:28, height:28, borderRadius:8, background:'var(--bg-overlay)', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 8px' }}>
                          <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', fontFamily:'var(--font-mono)' }}>×{g.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Offer */}
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Tag size={14} style={{ color:'var(--accent)' }}/>
                  <span className="label-sm">Promo Code</span>
                </div>
                {activeOffers.length > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'2px 8px' }} onClick={() => setShowOffers(v => !v)}>
                    {showOffers ? <><ChevronUp size={11}/> Hide</> : <><ChevronDown size={11}/> {activeOffers.length} offer{activeOffers.length!==1?'s':''}</>}
                  </button>
                )}
              </div>
              {offerApplied && (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--green-dim)', border:'1px solid rgba(22,163,74,0.25)', borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:10 }}>
                  <CheckCircle2 size={16} style={{ color:'var(--green)', flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div className="body-sm font-semibold" style={{ color:'var(--green)' }}>{removingOffer ? 'Removing…' : offerApplied.code + ' applied!'}</div>
                    <div className="body-xs" style={{ marginTop:2 }}>{offerApplied.name}</div>
                  </div>
                  <button className="btn btn-ghost btn-icon-sm" onClick={handleRemoveOffer} disabled={removingOffer} style={{ opacity: removingOffer ? 0.5 : 1 }}>{removingOffer ? <div className="spinner" style={{ width:13, height:13, borderWidth:2 }}/> : <X size={14}/>}</button>
                </div>
              )}
              {!offerApplied && (
                <div className="row gap-8" style={{ marginBottom: offerError ? 6 : showOffers && activeOffers.length ? 12 : 0 }}>
                  <input className="input" style={{ flex:1 }} placeholder="Enter offer code" value={offerCode}
                    onChange={e => { setOfferCode(e.target.value.toUpperCase()); setOfferError(''); }}
                    onKeyDown={e => { if(e.key==='Enter') handleApplyOffer(); }}/>
                  <button className="btn btn-secondary" disabled={applyingOffer||!offerCode.trim()} onClick={() => handleApplyOffer()}>
                    {applyingOffer ? <Loader size={13}/> : 'Apply'}
                  </button>
                </div>
              )}
              {offerError && (
                <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:6, padding:'8px 10px', marginTop:4 }}>
                  <AlertCircle size={12} style={{ color:'#ef4444', flexShrink:0 }}/>
                  <span className="body-xs" style={{ color:'#ef4444' }}>{offerError}</span>
                </div>
              )}
              {showOffers && activeOffers.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {activeOffers.map(o => {
                    const eligible  = o.eligible !== false;
                    const isApplied = offerApplied?.code === o.offerCode;
                    const isSelected= !isApplied && offerCode === o.offerCode;
                    const discount  = o.offerType === 'PERCENTAGE' ? `${o.discountValue}% off${o.maxDiscountAmount > 0 ? ` · max ₹${o.maxDiscountAmount}` : ''}` : `₹${o.discountValue} off`;
                    return (
                      <div key={o.offerId || o.offerCode}
                        onClick={() => { if (!eligible || isApplied) return; setOfferCode(o.offerCode); setOfferError(''); }}
                        style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 12px', borderRadius:'var(--radius-sm)', border:`1.5px solid ${isApplied?'var(--green)':isSelected?'var(--accent)':eligible?'var(--border-md)':'var(--border)'}`, background: isApplied?'var(--green-dim)':isSelected?'var(--accent-dim)':eligible?'var(--bg-elevated)':'var(--bg-base)', opacity:eligible?1:0.5, cursor:eligible&&!isApplied?'pointer':'default', transition:'all var(--dur)' }}>
                        <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:isApplied?'rgba(22,163,74,0.15)':eligible?'var(--accent-dim)':'var(--bg-overlay)' }}>
                          <Percent size={15} style={{ color:isApplied?'var(--green)':eligible?'var(--accent)':'var(--text-tertiary)' }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:isApplied?'var(--green)':eligible?'var(--accent)':'var(--text-tertiary)' }}>{o.offerCode}</span>
                            {isApplied && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:3, background:'var(--green)', color:'#fff', fontFamily:'var(--font-mono)' }}>APPLIED</span>}
                            {!eligible && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:3, background:'var(--bg-overlay)', color:'var(--text-tertiary)', fontFamily:'var(--font-mono)' }}>UNAVAILABLE</span>}
                          </div>
                          <div className="body-xs" style={{ color:eligible?'var(--text-secondary)':'var(--text-tertiary)', marginBottom:4 }}>{o.offerName}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                            <span style={{ fontSize:12, fontWeight:700, fontFamily:'var(--font-mono)', color:isApplied?'var(--green)':eligible?'var(--accent)':'var(--text-tertiary)' }}>{discount}</span>
                            {o.minOrderAmount > 0 && <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>Min ₹{o.minOrderAmount}</span>}
                            {o.validUntil && <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>Till {new Date(o.validUntil?.seconds?o.validUntil.seconds*1000:o.validUntil).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>}
                          </div>
                          {!eligible && o.ineligibleReason && <div style={{ marginTop:5, fontSize:10, color:'var(--orange)', display:'flex', alignItems:'center', gap:4 }}><AlertCircle size={10}/> {o.ineligibleReason}</div>}
                        </div>
                        {eligible && !isApplied && (
                          <button className="btn btn-secondary btn-sm" style={{ flexShrink:0, fontSize:11, padding:'4px 10px', alignSelf:'center' }} disabled={applyingOffer}
                            onClick={e => { e.stopPropagation(); handleApplyOffer(o.offerCode); }}>
                            {applyingOffer && offerCode===o.offerCode ? <Loader size={11}/> : 'Apply'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Self Handling */}
            <div className="card" onClick={() => { const next = !isSelfHandling; setIsSelfHandling(next); recalculateBilling(next); }} style={{ cursor: recalculating ? 'wait' : 'pointer', opacity: recalculating ? 0.7 : 1, transition: 'opacity 0.2s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:42, height:24, borderRadius:12, flexShrink:0, position:'relative', background:isSelfHandling?'var(--accent)':'var(--border-md)', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:3, left:isSelfHandling?21:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                </div>
                <div style={{ flex:1 }}>
                  <div className="body-sm font-semibold" style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <ShieldCheck size={14} style={{ color:isSelfHandling?'var(--accent)':'var(--text-tertiary)' }}/> Self Handling
                  </div>
                  <div className="body-xs" style={{ marginTop:2, color:'var(--text-secondary)' }}>You hand over the parcel directly to the rider</div>
                </div>
              </div>
            </div>
            {/* Payment method */}
            <div className="card">
              <div className="label-sm" style={{ marginBottom:12 }}>Payment Method</div>
              {[
                { mode:'RAZORPAY', icon:<CreditCard size={17}/>, title:'Pay Online',       sub:'UPI, Cards, Net Banking, Wallets' },
                { mode:'COD',      icon:<Wallet size={17}/>,     title:'Cash on Delivery', sub:'Pay when parcel is picked up' },
              ].map(({ mode, icon, title, sub }) => (
                <div key={mode} onClick={() => setPayMode(mode)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer', marginBottom:8, border:`1.5px solid ${payMode===mode?'var(--accent)':'var(--border-md)'}`, background:payMode===mode?'var(--accent-dim)':'var(--bg-elevated)', transition:'all var(--dur)' }}>
                  <div style={{ color:payMode===mode?'var(--accent)':'var(--text-tertiary)' }}>{icon}</div>
                  <div style={{ flex:1 }}>
                    <div className="body-sm font-semibold">{title}</div>
                    <div className="body-xs" style={{ color:'var(--text-secondary)' }}>{sub}</div>
                  </div>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${payMode===mode?'var(--accent)':'var(--border-md)'}`, background:payMode===mode?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all var(--dur)', flexShrink:0 }}>
                    {payMode===mode && <Check size={10} strokeWidth={3} style={{ color:'#fff' }}/>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ STEP 6 — CONFIRM ══ */}
        {step === 6 && (
          <>
            {placedOrder ? (
              <div className="col gap-12">
                <div className="card" style={{ textAlign:'center', padding:'32px 24px' }}>
                  <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--green-dim)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                    <CheckCircle2 size={32} style={{ color:'var(--green)' }}/>
                  </div>
                  <div className="title-sm" style={{ marginBottom:6 }}>{payMode==='COD'?'Order Placed!':'Payment Successful!'}</div>
                  <div className="body-xs" style={{ color:'var(--text-secondary)', marginBottom:20 }}>
                    Order #{(placedOrder.orderId||'').slice(-8).toUpperCase()} · Riders are being notified
                  </div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:28, fontWeight:800, color:'var(--accent)' }}>
                    ₹{Number(placedOrder.billing?.payableAmount||billing?.payableAmount||0).toFixed(2)}
                  </div>
                  <div className="body-xs" style={{ color:'var(--text-tertiary)', marginTop:4 }}>{payMode==='COD'?'Cash on Delivery':'Paid Online'}</div>
                </div>
                <button className="btn btn-primary btn-full" onClick={() => navigate(`/orders/${placedOrder.orderId}`,{replace:true})}>Track Order</button>
                <button className="btn btn-ghost btn-full" onClick={() => navigate('/',{replace:true})}>Back to Home</button>
              </div>
            ) : (
              <>
                <div className="card" style={{ marginBottom:12 }}>
                  <div className="label-sm" style={{ marginBottom:14 }}>Route</div>
                  <div style={{ display:'flex', gap:14 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, paddingTop:4 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 0 3px rgba(22,163,74,0.15)' }}/>
                      <div style={{ width:2, flex:1, minHeight:28, background:'var(--border-md)', borderRadius:1 }}/>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--red)', boxShadow:'0 0 0 3px rgba(239,68,68,0.15)' }}/>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', flex:1, gap:18 }}>
                      <div>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', marginBottom:3 }}>PICKUP</div>
                        {pickup.contactPerson && <div className="body-sm font-semibold">{pickup.contactPerson}</div>}
                        <div className="body-xs" style={{ color:'var(--text-secondary)' }}>{addrSummary(pickup)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.06em', color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', marginBottom:3 }}>DROP</div>
                        <div className="body-sm font-semibold">{drop.contactPerson||firstName}</div>
                        <div className="body-xs" style={{ color:'var(--text-secondary)' }}>{addrSummary(drop)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{ marginBottom:12 }}>
                  <div className="label-sm" style={{ marginBottom:12 }}>Order Details</div>
                  {[
                    { label:'Sender',        val:`${senderFirstName} ${senderLastName} · ${senderPhone}`.trim() },
                    { label:'Receiver',      val:`${firstName} ${lastName} · +91${rawPhone}`.trim() },
                    { label:'Items',         val:`${items.length} item${items.length!==1?'s':''} · ${items.map(i=>i.name).filter(Boolean).join(', ')}` },
                    { label:'Self Handling', val:isSelfHandling?'Yes — hand over to rider':'No' },
                    { label:'Payment',       val:payMode==='RAZORPAY'?'Online (Razorpay)':'Cash on Delivery' },
                    ...(offerApplied?[{ label:'Offer', val:offerApplied.code }]:[]),
                  ].map(({ label, val }) => (
                    <div key={label} className="summary-row">
                      <span className="key">{label}</span>
                      <span className="val" style={{ maxWidth:200, textAlign:'right', fontSize:12 }}>{val}</span>
                    </div>
                  ))}
                </div>
                {billing && <BillCard billing={billing} offerApplied={offerApplied}/>}
                {payMode==='RAZORPAY' && (
                  <div style={{ display:'flex', gap:10, marginTop:8, background:'var(--accent-dim)', border:'1px solid var(--accent-ring)', borderRadius:'var(--radius-sm)', padding:'11px 13px' }}>
                    <Info size={14} style={{ color:'var(--accent)', flexShrink:0, marginTop:1 }}/>
                    <div className="body-xs" style={{ lineHeight:1.7 }}>Tapping <strong>Pay & Place Order</strong> opens Razorpay. Order placed only after payment confirmed by server.</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginTop:12 }}>
            <AlertCircle size={14} style={{ flexShrink:0 }}/> {error}
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      {!placedOrder && (
        <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'var(--max-w)', background:'var(--tab-bg)', borderTop:'1px solid var(--border)', padding:'var(--sp-12) var(--sp-16)', paddingBottom:'calc(var(--sp-12) + env(safe-area-inset-bottom, 0px))' }}>
          <button className="btn btn-primary btn-full btn-lg" disabled={isBusy} onClick={goNext}>{btnLabel()}</button>
        </div>
      )}
    </div>
  );
}