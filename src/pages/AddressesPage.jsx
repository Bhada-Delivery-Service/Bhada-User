import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Star, MapPin, RefreshCw, Edit2, X, Check, Crosshair, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addressesAPI } from '../services/api';

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
    script.async = true;
    script.defer = true;
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
        street:      get('route') || get('sublocality_level_2') || '',
        area:        get('sublocality_level_1') || get('sublocality') || '',
        city:        get('locality') || get('administrative_area_level_2') || '',
        state:       get('administrative_area_level_1') || '',
        postalCode:  get('postal_code') || '',
        country:     get('country') || 'India',
        buildingOrFlat: get('premise') || get('subpremise') || '',
      });
    }
  });
}

/* ─── Map Picker Modal ─────────────────────────────────────────────────────── */

function MapPickerModal({ initialLat, initialLng, onConfirm, onClose }) {
  const mapRef     = useRef(null);
  const mapObj     = useRef(null);
  const markerRef  = useRef(null);
  const inputRef   = useRef(null);
  const [pos, setPos]         = useState({ lat: initialLat || 19.0760, lng: initialLng || 72.8777 });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    loadGoogleMaps().then(maps => {
      const center = { lat: pos.lat, lng: pos.lng };
      const map = new maps.Map(mapRef.current, {
        center,
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
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
        position: center,
        map,
        draggable: true,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#e8ff47',
          fillOpacity: 1,
          strokeColor: '#131929',
          strokeWeight: 2,
        },
      });
      markerRef.current = marker;

      // Update pos + address when marker dragged
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        const newPos = { lat: p.lat(), lng: p.lng() };
        setPos(newPos);
        reverseGeocode(newPos.lat, newPos.lng, (addr) => {
          setAddress([addr.buildingOrFlat, addr.street, addr.area, addr.city].filter(Boolean).join(', '));
        });
      });

      // Update pos + address when map clicked
      map.addListener('click', (e) => {
        const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        marker.setPosition(newPos);
        setPos(newPos);
        reverseGeocode(newPos.lat, newPos.lng, (addr) => {
          setAddress([addr.buildingOrFlat, addr.street, addr.area, addr.city].filter(Boolean).join(', '));
        });
      });

      // Search autocomplete
      const ac = new maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['geometry', 'formatted_address', 'address_components'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry) return;
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        map.setCenter(newPos);
        map.setZoom(17);
        marker.setPosition(newPos);
        setPos(newPos);
        setAddress(place.formatted_address || '');
      });

      // Initial reverse geocode
      reverseGeocode(pos.lat, pos.lng, (addr) => {
        setAddress([addr.buildingOrFlat, addr.street, addr.area, addr.city].filter(Boolean).join(', '));
      });

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const goToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const newPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(newPos);
        mapObj.current?.setCenter(newPos);
        mapObj.current?.setZoom(17);
        markerRef.current?.setPosition(newPos);
        reverseGeocode(newPos.lat, newPos.lng, (addr) => {
          setAddress([addr.buildingOrFlat, addr.street, addr.area, addr.city].filter(Boolean).join(', '));
        });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const confirm = () => {
    reverseGeocode(pos.lat, pos.lng, (addr) => {
      onConfirm({ lat: pos.lat, lng: pos.lng, ...addr });
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={onClose}>
          <X size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="Search for a place…"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', flex: 1 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2, background: 'var(--bg-0)' }}>
            <div className="loader" />
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* GPS button */}
        <button
          onClick={goToCurrentLocation}
          disabled={gpsLoading}
          style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 2,
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}
        >
          {gpsLoading ? <div className="loader" style={{ width: 18, height: 18 }} /> : <Crosshair size={18} style={{ color: 'var(--accent)' }} />}
        </button>
      </div>

      {/* Bottom sheet */}
      <div style={{
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--border)',
        padding: '14px 16px',
      }}>
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
        <button className="btn btn-primary btn-full" onClick={confirm}>
          <Check size={14} /> Confirm Location
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
  const [addresses,  setAddresses]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState('');
  const [deleting,   setDeleting]   = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = () => {
    setLoading(true);
    addressesAPI.getAll()
      .then(({ data }) => setAddresses(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
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

  // Called when map picker confirms a location
  const handleMapConfirm = ({ lat, lng, street, area, city, state, postalCode, country, buildingOrFlat }) => {
    setForm(f => ({
      ...f,
      latitude:       lat,
      longitude:      lng,
      street:         street  || f.street,
      area:           area    || f.area,
      city:           city    || f.city,
      state:          state   || f.state,
      postalCode:     postalCode || f.postalCode,
      country:        country || f.country || 'India',
      buildingOrFlat: buildingOrFlat || f.buildingOrFlat,
    }));
    setShowMapPicker(false);
  };

  const save = async () => {
    if (!form.street || !form.city) { showToast('⚠ Street and city are required'); return; }
    setSaving(true);
    try {
      if (editId) {
        await addressesAPI.update(editId, form);
        showToast('✓ Address updated');
      } else {
        await addressesAPI.create(form);
        showToast('✓ Address saved');
      }
      setShowForm(false);
      load();
    } catch (e) {
      showToast('✗ ' + (e.response?.data?.message || 'Failed to save'));
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    setDeleting(id);
    try {
      await addressesAPI.remove(id);
      showToast('✓ Address removed');
      load();
    } catch {
      showToast('✗ Failed to remove');
    } finally { setDeleting(null); }
  };

  const setPickup = async (id) => {
    try { await addressesAPI.setPreferredPickup(id); showToast('✓ Set as preferred pickup'); load(); }
    catch { showToast('✗ Failed'); }
  };
  const setDrop = async (id) => {
    try { await addressesAPI.setPreferredDrop(id); showToast('✓ Set as preferred drop'); load(); }
    catch { showToast('✗ Failed'); }
  };

  const fields = [
    { key: 'label',          label: 'Label (Home / Work)',  placeholder: 'Home'        },
    { key: 'buildingOrFlat', label: 'Building / Flat',      placeholder: 'A-204'       },
    { key: 'street',         label: 'Street *',             placeholder: 'MG Road'     },
    { key: 'area',           label: 'Area / Locality',      placeholder: 'Andheri West'},
    { key: 'city',           label: 'City *',               placeholder: 'Mumbai'      },
    { key: 'state',          label: 'State',                placeholder: 'Maharashtra' },
    { key: 'postalCode',     label: 'PIN Code',             placeholder: '400053'      },
    { key: 'contactPerson',  label: 'Contact Person',       placeholder: 'John Doe'    },
    { key: 'contactNumber',  label: 'Contact Number',       placeholder: '+91XXXXXXXXXX'},
  ];

  const hasPin = form.latitude && form.longitude;

  return (
    <div className="px-20 py-12">
      {/* Map Picker */}
      {showMapPicker && (
        <MapPickerModal
          initialLat={form.latitude ? parseFloat(form.latitude) : undefined}
          initialLng={form.longitude ? parseFloat(form.longitude) : undefined}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

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
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /></button>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} /> Add</button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(232,255,71,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 600 }}>{editId ? 'Edit Address' : 'New Address'}</div>
            <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setShowForm(false)}>
              <X size={14} />
            </button>
          </div>

          {/* Map pin picker button */}
          <button
            className="btn btn-secondary btn-full"
            style={{ marginBottom: 14, justifyContent: 'center', gap: 8 }}
            onClick={() => setShowMapPicker(true)}
          >
            <MapPin size={14} style={{ color: hasPin ? 'var(--accent)' : undefined }} />
            {hasPin
              ? `📍 Location set (${parseFloat(form.latitude).toFixed(4)}, ${parseFloat(form.longitude).toFixed(4)})`
              : 'Pick Location on Map'}
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
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : <><Check size={13} /> Save</>}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="loader" /></div>
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
          const id = addr.addressId || addr.id;
          const display = [addr.buildingOrFlat, addr.street, addr.area, addr.city].filter(Boolean).join(', ');
          return (
            <div key={id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'var(--accent-dim)', display: 'grid', placeItems: 'center',
                }}>
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
                  {/* Show map thumbnail if coordinates exist */}
                  {addr.latitude && addr.longitude && (
                    <div
                      style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', height: 80, cursor: 'pointer' }}
                      onClick={() => {
                        window.open(`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`, '_blank');
                      }}
                    >
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${addr.latitude},${addr.longitude}&zoom=15&size=600x120&scale=2&markers=color:yellow%7C${addr.latitude},${addr.longitude}&style=element:geometry%7Ccolor:0x0d1117&style=element:labels.text.fill%7Ccolor:0x8a9bb0&key=${GMAP_KEY}`}
                        alt="map"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  {(addr.isPreferredPickup || addr.isPreferredDrop) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {addr.isPreferredPickup && (
                        <span style={{ fontSize: 9, background: 'var(--green-dim)', color: 'var(--green)', borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          ⭐ PICKUP
                        </span>
                      )}
                      {addr.isPreferredDrop && (
                        <span style={{ fontSize: 9, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          ⭐ DROP
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(addr)}>
                  <Edit2 size={11} /> Edit
                </button>
                {!addr.isPreferredPickup && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setPickup(id)}>
                    <Star size={11} /> Pickup
                  </button>
                )}
                {!addr.isPreferredDrop && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setDrop(id)}>
                    <Star size={11} /> Drop
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginLeft: 'auto' }}
                  disabled={deleting === id} onClick={() => remove(id)}>
                  <Trash2 size={11} /> {deleting === id ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}