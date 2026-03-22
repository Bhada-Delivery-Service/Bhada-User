import React, { useState, useEffect } from 'react';
import {
  LogOut, ChevronRight, Bell, HelpCircle, Shield,
  MapPin, AlertCircle, Sun, Moon, Languages,
  Edit2, Check, X, Loader, User, Phone, Mail,
} from 'lucide-react';
import { useAuth }          from '../context/AuthContext';
import { useNavigate }      from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useTheme }         from '../context/Themecontext';
import { useLang }          from '../context/Langcontext';
import { profileAPI }       from '../services/api';
import toast                from 'react-hot-toast';

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
    if (!user?.uid) return;
    setLoading(true);
    profileAPI.getMe().then(({ data }) => {
      const u = data.data || data;
      setForm({
        firstName:     u.firstName     || '',
        lastName:      u.lastName      || '',
        email:         u.email         || '',
        buildingOrFlat:u.address?.buildingOrFlat || '',
        area:          u.address?.area           || '',
        street:        u.address?.street         || '',
        city:          u.address?.city           || '',
        state:         u.address?.state          || '',
        postalCode:    u.address?.postalCode      || '',
        country:       u.address?.country        || 'India',
      });
    }).catch(() => {
      setForm(f => ({ ...f, firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '' }));
    }).finally(() => setLoading(false));
  }, [user?.uid]);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        email:     form.email.trim() || undefined,
        address: {
          buildingOrFlat: form.buildingOrFlat.trim(),
          area:           form.area.trim(),
          street:         form.street.trim(),
          city:           form.city.trim(),
          state:          form.state.trim(),
          postalCode:     form.postalCode.trim(),
          country:        form.country.trim() || 'India',
        },
      };
      const { data } = await profileAPI.updateMe(payload);
      if (setUser) {
        const updated = { ...user, ...data.data };
        setUser(updated);
        // Persist to localStorage so name shows correctly after page refresh
        localStorage.setItem('user', JSON.stringify(updated));
      }
      toast.success('Profile updated!');
      setEditing(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const initials = ((form.firstName?.[0] || '') + (form.lastName?.[0] || '')).toUpperCase() || user?.phoneNumber?.slice(-2) || '?';

  const menuItems = [
    { icon: MapPin,       label: 'Saved Addresses',     sub: 'Manage delivery locations', onClick: () => navigate('/addresses'), color: 'var(--accent)' },
    { icon: AlertCircle,  label: t('disputes'),          sub: 'View and raise disputes',   onClick: () => navigate('/disputes'),  color: 'var(--orange)' },
    { icon: HelpCircle,   label: 'Feedback',             sub: 'Share your experience',     onClick: () => navigate('/feedback'),  color: 'var(--blue)'  },
    { icon: Bell,         label: t('notifications'),     sub: 'View recent notifications', onClick: openDrawer,                   color: 'var(--purple)' },
    { icon: Shield,       label: 'Privacy & Security',   sub: 'Account settings',          onClick: () => {},                     color: 'var(--text-secondary)' },
  ];

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:300 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>
      {/* ── Profile header ── */}
      <div style={{ padding:'var(--sp-20) var(--sp-16) var(--sp-16)', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom: editing ? 20 : 0 }}>
          {/* Avatar */}
          <div style={{
            width:64, height:64, borderRadius:'50%',
            background:'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display:'grid', placeItems:'center',
            fontSize:24, fontWeight:800, color:'#fff',
            flexShrink:0,
            boxShadow:'0 0 20px var(--accent-glow)',
          }}>
            {initials}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            {!editing ? (
              <>
                <div style={{ fontWeight:800, fontSize:20, color:'var(--text-primary)', letterSpacing:'-0.03em', marginBottom:3 }}>
                  {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : 'Your Name'}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-tertiary)', fontSize:12, marginBottom:6 }}>
                  <Phone size={11} />
                  <span style={{ fontFamily:'var(--font-mono)' }}>{user?.phoneNumber || '—'}</span>
                </div>
                {form.email && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-tertiary)', fontSize:12 }}>
                    <Mail size={11} />
                    <span className="truncate">{form.email}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:'flex', gap:8 }}>
                <input className="input" placeholder="First name" value={form.firstName} onChange={e => upd('firstName', e.target.value)} style={{ height:38, fontSize:13 }} />
                <input className="input" placeholder="Last name"  value={form.lastName}  onChange={e => upd('lastName',  e.target.value)} style={{ height:38, fontSize:13 }} />
              </div>
            )}
          </div>

          {/* Edit/Save/Cancel buttons */}
          {!editing ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(true)}
              style={{ flexShrink:0 }}
            >
              <Edit2 size={12} /> Edit
            </button>
          ) : (
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>
                <X size={12} />
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader size={12} style={{ animation:'spin 0.7s linear infinite' }} /> : <Check size={12} />}
              </button>
            </div>
          )}
        </div>

        {/* Edit form */}
        {editing && (
          <div style={{ marginTop:16, animation:'slideUp 0.2s ease' }}>
            <div className="form-group" style={{ marginBottom:12 }}>
              <label className="form-label">Email (optional)</label>
              <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={e => upd('email', e.target.value)} />
            </div>
            <div style={{ marginBottom:8, fontSize:11, fontWeight:600, color:'var(--text-tertiary)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Address</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { k:'buildingOrFlat', label:'Building/Flat', span: false },
                { k:'area',           label:'Area',          span: false },
                { k:'street',         label:'Street',        span: true  },
                { k:'city',           label:'City',          span: false },
                { k:'state',          label:'State',         span: false },
                { k:'postalCode',     label:'Pincode',       span: false },
              ].map(({ k, label, span }) => (
                <input
                  key={k}
                  className="input"
                  placeholder={label}
                  value={form[k]}
                  onChange={e => upd(k, e.target.value)}
                  style={{ height:38, fontSize:13, gridColumn: span ? '1 / -1' : undefined }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Settings ── */}
      <div style={{ padding:'var(--sp-16)' }}>

        {/* Theme + Language row */}
        <div className="card" style={{ marginBottom:'var(--sp-12)' }}>
          {/* Theme toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:14, borderBottom:'1px solid var(--border)', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'grid', placeItems:'center' }}>
                {isDark ? <Moon size={15} style={{ color:'var(--blue)' }} /> : <Sun size={15} style={{ color:'var(--yellow)' }} />}
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{t('theme') || 'Theme'}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{isDark ? 'Dark mode' : 'Light mode'}</div>
              </div>
            </div>
            <div className="seg-control">
              <button className={`seg-option${isDark ? '' : ' active'}`} onClick={() => setTheme('light')}>
                <Sun size={11} /> Light
              </button>
              <button className={`seg-option${isDark ? ' active' : ''}`} onClick={() => setTheme('dark')}>
                <Moon size={11} /> Dark
              </button>
            </div>
          </div>

          {/* Language toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'grid', placeItems:'center' }}>
                <Languages size={15} style={{ color:'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{t('language') || 'Language'}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{lang === 'hi' ? 'हिन्दी' : 'English'}</div>
              </div>
            </div>
            <div className="seg-control">
              <button className={`seg-option${lang === 'en' ? ' active' : ''}`} onClick={() => changeLang('en')}>EN</button>
              <button className={`seg-option${lang === 'hi' ? ' active' : ''}`} onClick={() => changeLang('hi')}>हि</button>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="card" style={{ marginBottom:'var(--sp-12)', padding:0, overflow:'hidden' }}>
          {menuItems.map(({ icon: Icon, label, sub, onClick, color }, i) => (
            <div
              key={label}
              className="list-item"
              style={{ borderBottom: i < menuItems.length - 1 ? '1px solid var(--border)' : 'none' }}
              onClick={onClick}
            >
              <div style={{ width:36, height:36, borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'grid', placeItems:'center', flexShrink:0 }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div className="list-body">
                <div className="list-title">{label}</div>
                <div className="list-subtitle">{sub}</div>
              </div>
              <ChevronRight size={15} style={{ color:'var(--text-tertiary)' }} />
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          className="btn btn-danger btn-lg"
          onClick={() => { logout(); navigate('/login'); }}
        >
          <LogOut size={15} /> {t('logout') || 'Sign Out'}
        </button>

        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--text-tertiary)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em' }}>
          BHADA v1.0 · User App
        </div>

        <div style={{ height:8 }} />
      </div>
    </div>
  );
}