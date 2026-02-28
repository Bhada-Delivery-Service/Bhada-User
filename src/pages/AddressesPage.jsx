import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Star, MapPin, RefreshCw, Edit2, X, Check, Crosshair } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addressesAPI } from '../services/api';

/* ─── Skeleton shimmer styles injected once ───────────────────────────────── */
const SKELETON_STYLE = `
  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse-badge {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--skeleton-base, rgba(255,255,255,0.05)) 25%,
      var(--skeleton-shine, rgba(255,255,255,0.12)) 50%,
      var(--skeleton-base, rgba(255,255,255,0.05)) 75%
    );
    background-size: 600px 100%;
    animation: shimmer 1.4s infinite linear;
    border-radius: 6px;
  }
  .addr-card-enter {
    animation: fadeIn 0.25s ease forwards;
  }
  .btn-spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: currentColor;
    animation: spin 0.6s linear infinite;
    display: inline-block; flex-shrink: 0;
  }
  .preferred-badge-loading {
    animation: pulse-badge 1s ease infinite;
  }
`;

function injectStyles() {
  if (document.getElementById('addr-skeleton-styles')) return;
  const el = document.createElement('style');
  el.id = 'addr-skeleton-styles';
  el.textContent = SKELETON_STYLE;
  document.head.appendChild(el);
}

/* ─── Skeleton card ────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'grid', gap: 7 }}>
          <div className="skeleton" style={{ height: 10, width: '40%' }} />
          <div className="skeleton" style={{ height: 12, width: '85%' }} />
          <div className="skeleton" style={{ height: 10, width: '55%' }} />
          <div className="skeleton" style={{ height: 72, width: '100%', borderRadius: 8, marginTop: 4 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <div className="skeleton" style={{ height: 26, width: 56, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 26, width: 72, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 26, width: 72, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 26, width: 72, borderRadius: 6, marginLeft: 'auto' }} />
      </div>
    </div>
  );
}

/* ─── Inline spinner button ────────────────────────────────────────────────── */
function SpinBtn({ loading, onClick, children, style, className = 'btn btn-ghost btn-sm', disabled }) {
  return (
    <button
      className={className}
      style={{ gap: 5, ...style }}
      disabled={loading || disabled}
      onClick={onClick}
    >
      {loading ? <span className="btn-spinner" /> : children}
    </button>
  );
}

/* ─── Google Maps helpers ──────────────────────────────────────────────────── */
const GMAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const existing = document.getElementById('gmap-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmap-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAP_KEY}&libraries=places`;
    script.async = true; script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function reverseGeocode(lat, lng, callback) {
  if (!window.google?.maps) return;
  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const c = results[0].address_components;
      const get = (type) => c.find(x => x.types.includes(type))?.long_name || '';
      callback({
        street:         get('route') || get('sublocality_level_2') || '',
        area:           get('sublocality_level_1') || get('sublocality') || '',
        city:           get('locality') || get('administrative_area_level_2') || '',
        state:          get('administrative_area_level_1') || '',
        postalCode:     get('postal_code') || '',
        country:        get('country') || 'India',
        buildingOrFlat: get('premise') || get('subpremise') || '',
      });
    }
  });
}

/* ─── Map Picker Modal ─────────────────────────────────────────────────────── */
function MapPickerModal({ initialLat, initialLng, onConfirm, onClose }) {
  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const markerRef = useRef(null);
  const inputRef  = useRef(null);
  const [pos, setPos]         = useState({ lat: initialLat || 19.0760, lng: initialLng || 72.8777 });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadGoogleMaps().then(maps => {
      const center = { lat: pos.lat, lng: pos.lng };
      const map = new maps.Map(mapRef.current, {
        center, zoom: 16, disableDefaultUI: true, zoomControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c2433' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080e18' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        ],
      });
      mapObj.current = map;
      const marker = new maps.Marker({
        position: center, map, draggable: true,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e8ff47', fillOpacity: 1, strokeColor: '#131929', strokeWeight: 2 },
      });
      markerRef.current = marker;
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        const np = { lat: p.lat(), lng: p.lng() };
        setPos(np);
        reverseGeocode(np.lat, np.lng, (a) => setAddress([a.buildingOrFlat, a.street, a.area, a.city].filter(Boolean).join(', ')));
      });
      map.addListener('click', (e) => {
        const np = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        marker.setPosition(np); setPos(np);
        reverseGeocode(np.lat, np.lng, (a) => setAddress([a.buildingOrFlat, a.street, a.area, a.city].filter(Boolean).join(', ')));
      });
      const ac = new maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['geometry', 'formatted_address', 'address_components'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry) return;
        const np = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        map.setCenter(np); map.setZoom(17); marker.setPosition(np); setPos(np);
        setAddress(place.formatted_address || '');
      });
      reverseGeocode(pos.lat, pos.lng, (a) => setAddress([a.buildingOrFlat, a.street, a.area, a.city].filter(Boolean).join(', ')));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const goToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const np = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(np);
        mapObj.current?.setCenter(np); mapObj.current?.setZoom(17); markerRef.current?.setPosition(np);
        reverseGeocode(np.lat, np.lng, (a) => setAddress([a.buildingOrFlat, a.street, a.area, a.city].filter(Boolean).join(', ')));
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const confirm = () => {
    setConfirming(true);
    reverseGeocode(pos.lat, pos.lng, (addr) => {
      onConfirm({ lat: pos.lat, lng: pos.lng, ...addr });
      setConfirming(false);
    });
    // Fallback if reverseGeocode doesn't fire (no maps loaded)
    setTimeout(() => setConfirming(false), 3000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={onClose}><X size={16} /></button>
        <div style={{ flex: 1 }}>
          <input ref={inputRef} className="input" placeholder="Search for a place…" style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2, background: 'var(--bg-0)' }}>
            <div className="loader" />
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        <button
          onClick={goToCurrentLocation}
          disabled={gpsLoading}
          style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 2, width: 44, height: 44, borderRadius: 12, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          {gpsLoading ? <span className="btn-spinner" style={{ width: 18, height: 18, borderWidth: 2.5 }} /> : <Crosshair size={18} style={{ color: 'var(--accent)' }} />}
        </button>
      </div>
      <div style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <MapPin size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 2 }}>Selected Location</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{address || 'Drag pin or click map to select'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
            </div>
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={confirm} disabled={confirming}>
          {confirming
            ? <><span className="btn-spinner" /> Confirming…</>
            : <><Check size={14} /> Confirm Location</>}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */
const emptyForm = {
  label: '', buildingOrFlat: '', street: '', area: '',
  city: '', state: '', postalCode: '', country: 'India',
  contactPerson: '', contactNumber: '', latitude: '', longitude: '',
};

export default function AddressesPage() {
  const navigate = useNavigate();

  useEffect(() => { injectStyles(); }, []);

  const [addresses,     setAddresses]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState('');
  const [deleting,      setDeleting]      = useState(null);   // address id being deleted
  const [settingPickup, setSettingPickup] = useState(null);   // address id being set as pickup
  const [settingDrop,   setSettingDrop]   = useState(null);   // address id being set as drop
  const [showMapPicker, setShowMapPicker] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200); };

  const load = async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data } = await addressesAPI.getAll();
      setAddresses(data.data || []);
    } catch {
      showToast('✗ Failed to load addresses');
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (addr) => {
    setForm({
      label:          addr.label || '',
      buildingOrFlat: addr.buildingOrFlat || '',
      street:         addr.street || '',
      area:           addr.area || '',
      city:           addr.city || '',
      state:          addr.state || '',
      postalCode:     addr.postalCode || '',
      country:        addr.country || 'India',
      contactPerson:  addr.contactPerson || '',
      contactNumber:  addr.contactNumber || '',
      latitude:       addr.latitude || '',
      longitude:      addr.longitude || '',
    });
    setEditId(addr.addressId || addr.id);
    setShowForm(true);
  };

  const handleMapConfirm = ({ lat, lng, street, area, city, state, postalCode, country, buildingOrFlat }) => {
    setForm(f => ({
      ...f,
      latitude:       lat,
      longitude:      lng,
      street:         street       || f.street,
      area:           area         || f.area,
      city:           city         || f.city,
      state:          state        || f.state,
      postalCode:     postalCode   || f.postalCode,
      country:        country      || f.country || 'India',
      buildingOrFlat: buildingOrFlat || f.buildingOrFlat,
    }));
    setShowMapPicker(false);
  };

  const save = async () => {
    if (!form.street)   { showToast('⚠ Street is required'); return; }
    if (!form.city)     { showToast('⚠ City is required'); return; }
    if (!form.latitude || !form.longitude) {
      showToast('⚠ Please pick a location on the map first');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) };
      if (editId) {
        await addressesAPI.update(editId, payload);
        showToast('✓ Address updated');
      } else {
        await addressesAPI.create(payload);
        showToast('✓ Address saved');
      }
      setShowForm(false);
      load();
    } catch (e) {
      showToast('✗ ' + (e.response?.data?.message || e.message || 'Failed to save'));
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    setDeleting(id);
    try {
      await addressesAPI.remove(id);
      showToast('✓ Address removed');
      // Optimistically remove from list immediately
      setAddresses(prev => prev.filter(a => (a.addressId || a.id) !== id));
    } catch (e) {
      showToast('✗ ' + (e.response?.data?.message || 'Failed to remove'));
      load(); // reload to restore
    } finally { setDeleting(null); }
  };

  const setPickup = async (id) => {
    setSettingPickup(id);
    try {
      await addressesAPI.setPreferredPickup(id);
      showToast('✓ Set as preferred pickup');
      // Optimistically update badges
      setAddresses(prev => prev.map(a => ({
        ...a,
        isPreferredPickup: (a.addressId || a.id) === id,
      })));
    } catch (e) {
      showToast('✗ ' + (e.response?.data?.message || 'Failed to set pickup'));
    } finally { setSettingPickup(null); }
  };

  const setDrop = async (id) => {
    setSettingDrop(id);
    try {
      await addressesAPI.setPreferredDrop(id);
      showToast('✓ Set as preferred drop');
      // Optimistically update badges
      setAddresses(prev => prev.map(a => ({
        ...a,
        isPreferredDrop: (a.addressId || a.id) === id,
      })));
    } catch (e) {
      showToast('✗ ' + (e.response?.data?.message || 'Failed to set drop'));
    } finally { setSettingDrop(null); }
  };

  const fields = [
    { key: 'label',          label: 'Label (Home / Work)',  placeholder: 'Home'         },
    { key: 'buildingOrFlat', label: 'Building / Flat',      placeholder: 'A-204'        },
    { key: 'street',         label: 'Street *',             placeholder: 'MG Road'      },
    { key: 'area',           label: 'Area / Locality',      placeholder: 'Andheri West' },
    { key: 'city',           label: 'City *',               placeholder: 'Mumbai'       },
    { key: 'state',          label: 'State',                placeholder: 'Maharashtra'  },
    { key: 'postalCode',     label: 'PIN Code',             placeholder: '400053'       },
    { key: 'contactPerson',  label: 'Contact Person',       placeholder: 'John Doe'     },
    { key: 'contactNumber',  label: 'Contact Number',       placeholder: '+91XXXXXXXXXX'},
  ];

  const hasPin = form.latitude && form.longitude;

  return (
    <div className="px-20 py-12">
      {showMapPicker && (
        <MapPickerModal
          initialLat={form.latitude ? parseFloat(form.latitude) : undefined}
          initialLng={form.longitude ? parseFloat(form.longitude) : undefined}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.startsWith('✓') ? 'success' : 'error'}`}>{toast}</div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div className="section-title" style={{ flex: 1 }}>Saved Addresses</div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => load(true)}
          disabled={refreshing}
          style={{ gap: 5 }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card addr-card-enter" style={{ marginBottom: 16, borderColor: 'rgba(232,255,71,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 600 }}>{editId ? 'Edit Address' : 'New Address'}</div>
            <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setShowForm(false)}>
              <X size={14} />
            </button>
          </div>

          {/* Map pin picker */}
          <button
            className="btn btn-secondary btn-full"
            style={{ marginBottom: 14, justifyContent: 'center', gap: 8, borderColor: !hasPin ? 'rgba(255,80,80,0.5)' : undefined }}
            onClick={() => setShowMapPicker(true)}
          >
            <MapPin size={14} style={{ color: hasPin ? 'var(--accent)' : 'rgba(255,80,80,0.8)' }} />
            {hasPin
              ? `📍 Location set (${parseFloat(form.latitude).toFixed(4)}, ${parseFloat(form.longitude).toFixed(4)})`
              : '⚠ Pick Location on Map (required)'}
          </button>

          <div style={{ display: 'grid', gap: 10 }}>
            {fields.map(({ key, label, placeholder }) => (
              <div key={key} className="input-group">
                <label className="input-label">{label}</label>
                <input className="input" placeholder={placeholder}
                  value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1, gap: 6 }} disabled={saving} onClick={save}>
              {saving
                ? <><span className="btn-spinner" /> Saving…</>
                : <><Check size={13} /> Save</>}
            </button>
          </div>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        /* Skeleton placeholders */
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : addresses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <div className="empty-title">No saved addresses</div>
          <div className="empty-sub">Save addresses for faster order placement</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
            <Plus size={14} /> Add Address
          </button>
        </div>
      ) : (
        addresses.map(addr => {
          const id      = addr.addressId || addr.id;
          const display = [addr.buildingOrFlat, addr.street, addr.area, addr.city].filter(Boolean).join(', ');
          const isBeingDeleted  = deleting === id;
          const isBeingPickup   = settingPickup === id;
          const isBeingDrop     = settingDrop === id;
          const anyBusy         = isBeingDeleted || isBeingPickup || isBeingDrop;

          return (
            <div
              key={id}
              className="card addr-card-enter"
              style={{
                marginBottom: 12,
                opacity: isBeingDeleted ? 0.45 : 1,
                transition: 'opacity 0.2s ease',
                pointerEvents: isBeingDeleted ? 'none' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--accent-dim)', display: 'grid', placeItems: 'center' }}>
                  <MapPin size={15} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {addr.label && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                      {addr.label}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{display || '—'}</div>
                  {addr.contactPerson && (
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      {addr.contactPerson} · {addr.contactNumber}
                    </div>
                  )}
                  {addr.latitude && addr.longitude && (
                    <div
                      style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', height: 80, cursor: 'pointer' }}
                      onClick={() => window.open(`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`, '_blank')}
                    >
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${addr.latitude},${addr.longitude}&zoom=15&size=600x120&scale=2&markers=color:yellow%7C${addr.latitude},${addr.longitude}&style=element:geometry%7Ccolor:0x0d1117&style=element:labels.text.fill%7Ccolor:0x8a9bb0&key=${GMAP_KEY}`}
                        alt="map"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  {/* Preferred badges — pulse when actively being set */}
                  {(addr.isPreferredPickup || addr.isPreferredDrop || isBeingPickup || isBeingDrop) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {(addr.isPreferredPickup || isBeingPickup) && (
                        <span
                          className={isBeingPickup ? 'preferred-badge-loading' : ''}
                          style={{ fontSize: 9, background: 'var(--green-dim)', color: 'var(--green)', borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {isBeingPickup ? <span className="btn-spinner" style={{ width: 8, height: 8, borderWidth: 1.5, color: 'var(--green)' }} /> : '⭐'} PICKUP
                        </span>
                      )}
                      {(addr.isPreferredDrop || isBeingDrop) && (
                        <span
                          className={isBeingDrop ? 'preferred-badge-loading' : ''}
                          style={{ fontSize: 9, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {isBeingDrop ? <span className="btn-spinner" style={{ width: 8, height: 8, borderWidth: 1.5, color: 'var(--blue)' }} /> : '⭐'} DROP
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions row */}
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={anyBusy}
                  onClick={() => openEdit(addr)}
                >
                  <Edit2 size={11} /> Edit
                </button>

                {!addr.isPreferredPickup && (
                  <SpinBtn
                    loading={isBeingPickup}
                    disabled={anyBusy && !isBeingPickup}
                    onClick={() => setPickup(id)}
                  >
                    <Star size={11} /> Pickup
                  </SpinBtn>
                )}

                {!addr.isPreferredDrop && (
                  <SpinBtn
                    loading={isBeingDrop}
                    disabled={anyBusy && !isBeingDrop}
                    onClick={() => setDrop(id)}
                  >
                    <Star size={11} /> Drop
                  </SpinBtn>
                )}

                <SpinBtn
                  loading={isBeingDeleted}
                  disabled={anyBusy && !isBeingDeleted}
                  onClick={() => remove(id)}
                  style={{ color: isBeingDeleted ? undefined : 'var(--red)', marginLeft: 'auto' }}
                >
                  <Trash2 size={11} /> Remove
                </SpinBtn>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}