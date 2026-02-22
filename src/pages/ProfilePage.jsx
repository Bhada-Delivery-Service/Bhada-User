import React, { useState, useEffect } from 'react';
import {
  LogOut, ChevronRight, Bell, HelpCircle, Shield,
  MapPin, AlertCircle, Sun, Moon, Languages,
  Edit2, Check, X, Loader,
} from 'lucide-react';
import { useAuth }          from '../context/AuthContext';
import { useNavigate }      from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useTheme }         from '../context/Themecontext';
import { useLang }          from '../context/Langcontext';
import { profileAPI }       from '../services/api';
import toast                from 'react-hot-toast';

function Field({ label, value, onChange, type = 'text', placeholder, readOnly = false }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder || label}
        readOnly={readOnly}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: readOnly ? 'var(--bg-surface)' : 'var(--bg-base)',
          color: readOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          opacity: readOnly ? 0.7 : 1,
        }}
      />
    </div>
  );
}

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate  = useNavigate();
  const { openDrawer }            = useNotifications();
  const { theme, setTheme, isDark } = useTheme();
  const { lang, changeLang, t }   = useLang();

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    buildingOrFlat: '', area: '', street: '',
    city: '', state: '', postalCode: '', country: '',
  });

  useEffect(() => {
    setLoading(true);
    profileAPI.getMe()
      .then(({ data }) => {
        const u = data.data;
        setForm({
          firstName:      u.firstName                  || '',
          lastName:       u.lastName                   || '',
          email:          u.email                      || '',
          buildingOrFlat: u.address?.buildingOrFlat    || '',
          area:           u.address?.area              || '',
          street:         u.address?.street            || '',
          city:           u.address?.city              || '',
          state:          u.address?.state             || '',
          postalCode:     u.address?.postalCode        || '',
          country:        u.address?.country           || '',
        });
        const merged = { ...user, ...u };
        setUser(merged);
        localStorage.setItem('user', JSON.stringify(merged));
      })
      .catch(() => {
        setForm({
          firstName:      user?.firstName              || '',
          lastName:       user?.lastName               || '',
          email:          user?.email                  || '',
          buildingOrFlat: user?.address?.buildingOrFlat || '',
          area:           user?.address?.area           || '',
          street:         user?.address?.street         || '',
          city:           user?.address?.city           || '',
          state:          user?.address?.state          || '',
          postalCode:     user?.address?.postalCode     || '',
          country:        user?.address?.country        || '',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const set = key => val => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await profileAPI.updateMe({
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email || undefined,
        address: {
          buildingOrFlat: form.buildingOrFlat,
          area:           form.area,
          street:         form.street,
          city:           form.city,
          state:          form.state,
          postalCode:     form.postalCode,
          country:        form.country || 'India',
        },
      });
      const merged = { ...user, ...data.data };
      setUser(merged);
      localStorage.setItem('user', JSON.stringify(merged));
      toast.success('Profile updated!');
      setEditing(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      firstName:      user?.firstName               || '',
      lastName:       user?.lastName                || '',
      email:          user?.email                   || '',
      buildingOrFlat: user?.address?.buildingOrFlat || '',
      area:           user?.address?.area           || '',
      street:         user?.address?.street         || '',
      city:           user?.address?.city           || '',
      state:          user?.address?.state          || '',
      postalCode:     user?.address?.postalCode     || '',
      country:        user?.address?.country        || '',
    });
    setEditing(false);
  };

  const firstName = user?.firstName || '';
  const lastName  = user?.lastName  || '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'User';
  const initial   = (firstName[0] || user?.phoneNumber?.[3] || 'U').toUpperCase();

  const menuItems = [
    { icon: Bell,        label: t('notifications'),  action: openDrawer,                  color: 'var(--blue)'   },
    { icon: MapPin,      label: t('savedAddresses'), action: () => navigate('/addresses'), color: 'var(--green)'  },
    { icon: AlertCircle, label: t('myDisputes'),     action: () => navigate('/disputes'),  color: 'var(--orange)' },
    { icon: HelpCircle,  label: t('helpSupport'),    action: () => {},                    color: 'var(--accent)' },
    { icon: Shield,      label: t('privacyPolicy'),  action: () => {},                    color: 'var(--purple)' },
  ];

  return (
    <div>
      {/* Profile Header */}
      <div style={{
        padding: 'var(--sp-24) var(--sp-16)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-16)',
      }}>
        <div className="avatar avatar-lg">
          {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : initial}
        </div>
        <div style={{ flex: 1 }}>
          <div className="title-sm" style={{ marginBottom: 2 }}>{fullName}</div>
          <div className="mono body-xs">{user?.phoneNumber}</div>
          {user?.email && <div className="body-xs" style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{user.email}</div>}
        </div>
        {!editing ? (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Edit2 size={13} /> Edit
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={handleCancel}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={13} /> Cancel
          </button>
        )}
      </div>

      <div style={{ padding: 'var(--sp-16)' }}>

        {editing ? (
          /* ── EDIT MODE ─────────────────────────────────────── */
          <div>
            <div className="label-sm" style={{ marginBottom: 'var(--sp-8)' }}>Personal Info</div>
            <div className="card" style={{ marginBottom: 'var(--sp-16)' }}>
              <Field label="First Name" value={form.firstName} onChange={set('firstName')} />
              <Field label="Last Name"  value={form.lastName}  onChange={set('lastName')}  />
              <Field label="Email" type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" />
              <Field label="Phone" value={user?.phoneNumber || ''} readOnly />
            </div>

            <div className="label-sm" style={{ marginBottom: 'var(--sp-8)' }}>Address</div>
            <div className="card" style={{ marginBottom: 'var(--sp-16)' }}>
              <Field label="Flat / Building" value={form.buildingOrFlat} onChange={set('buildingOrFlat')} placeholder="e.g. Flat 4B, Tower A" />
              <Field label="Area / Colony"   value={form.area}           onChange={set('area')}           placeholder="e.g. Andheri West" />
              <Field label="Street"          value={form.street}         onChange={set('street')}         placeholder="e.g. MG Road" />
              <Field label="City"            value={form.city}           onChange={set('city')}           placeholder="e.g. Mumbai" />
              <Field label="State"           value={form.state}          onChange={set('state')}          placeholder="e.g. Maharashtra" />
              <Field label="Postal Code"     value={form.postalCode}     onChange={set('postalCode')}     placeholder="e.g. 400058" />
              <Field label="Country"         value={form.country}        onChange={set('country')}        placeholder="India" />
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {saving
                ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <><Check size={16} /> Save Changes</>}
            </button>
          </div>

        ) : (
          /* ── VIEW MODE ─────────────────────────────────────── */
          <>
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <div className="label-sm" style={{ marginBottom: 'var(--sp-8)' }}>{t('accountInfo')}</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {[
                  { label: t('phone'),  val: user?.phoneNumber || '—' },
                  { label: t('name'),   val: fullName },
                  { label: t('email'),  val: user?.email || '—' },
                  { label: 'Address',   val: [form.buildingOrFlat, form.area, form.city].filter(Boolean).join(', ') || '—' },
                  { label: t('userId'), val: (user?.uid || '').slice(-8).toUpperCase(), mono: true },
                ].map(({ label, val, mono }, i, arr) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--sp-12) var(--sp-16)',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span className="body-xs">{label}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 500, maxWidth: '60%', textAlign: 'right',
                      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                      color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div style={{ marginTop: 'var(--sp-20)', marginBottom: 'var(--sp-4)' }}>
              <div className="label-sm" style={{ marginBottom: 'var(--sp-8)' }}>{t('settings')}</div>
              <div className="card">
                <div style={{ marginBottom: 'var(--sp-16)' }}>
                  <div className="row gap-8" style={{ marginBottom: 'var(--sp-10)' }}>
                    {isDark ? <Moon size={14} style={{ color: 'var(--accent)' }} /> : <Sun size={14} style={{ color: 'var(--orange)' }} />}
                    <span className="body-sm font-semibold">{t('appearance')}</span>
                  </div>
                  <div className="seg-control">
                    <button className={`seg-option ${theme === 'dark'  ? 'active' : ''}`} onClick={() => setTheme('dark')}>
                      <Moon size={12} /> {t('darkMode')}
                    </button>
                    <button className={`seg-option ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
                      <Sun size={12} /> {t('lightMode')}
                    </button>
                  </div>
                </div>
                <div className="divider" style={{ margin: '0 0 var(--sp-16)' }} />
                <div>
                  <div className="row gap-8" style={{ marginBottom: 'var(--sp-10)' }}>
                    <Languages size={14} style={{ color: 'var(--accent)' }} />
                    <span className="body-sm font-semibold">{t('language')}</span>
                  </div>
                  <div className="seg-control">
                    <button className={`seg-option seg-option-accent ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>
                      🇬🇧 English
                    </button>
                    <button className={`seg-option seg-option-accent ${lang === 'hi' ? 'active' : ''}`} onClick={() => changeLang('hi')}>
                      🇮🇳 हिन्दी
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu */}
            <div style={{ marginTop: 'var(--sp-20)', marginBottom: 'var(--sp-4)' }}>
              <div className="label-sm" style={{ marginBottom: 'var(--sp-8)' }}>More</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {menuItems.map(({ icon: Icon, label, action, color }) => (
                  <button key={label} onClick={action} className="list-item"
                    style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <div className="list-icon" style={{ background: `${color}18` }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div className="list-body"><div className="list-title">{label}</div></div>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sign Out */}
            <div style={{ marginTop: 'var(--sp-20)' }}>
              <button className="btn btn-danger btn-full btn-lg"
                onClick={async () => { await logout(); navigate('/login'); }}>
                <LogOut size={16} /> {t('signOut')}
              </button>
            </div>

            <div className="mono" style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 10, marginTop: 'var(--sp-24)' }}>
              {t('version')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}