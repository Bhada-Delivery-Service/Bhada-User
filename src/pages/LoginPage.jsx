import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/Langcontext';

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
  return null;
}

export default function LoginPage() {
  const { loginWithFirebase } = useAuth();
  const { t, lang, changeLang } = useLang();
  const navigate               = useNavigate();
  const [step, setStep]        = useState('phone');
  const [phone, setPhone]      = useState('');
  const [otp, setOtp]          = useState('');
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const confirmRef             = useRef(null);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    const normalized = normalizePhone(phone);
    if (!normalized) { setError(t('invalidPhone')); return; }
    setLoading(true);
    try {
      confirmRef.current = await sendOTP(normalized, 'recaptcha-container');
      setStep('otp');
    } catch (err) {
      console.error('[LoginPage] sendOTP error:', err);
      setError(err.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError(t('enterSixDigit')); return; }
    if (!confirmRef.current) { setError(t('sessionExpired')); return; }
    setLoading(true);
    try {
      const idToken = await verifyOTP(confirmRef.current, otp);
      await loginWithFirebase(idToken);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[LoginPage] verify error:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Verification failed.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleBack = () => { setStep('phone'); setOtp(''); setError(''); confirmRef.current = null; };
  const displayPhone = normalizePhone(phone) || phone;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'var(--bg-0)',
    }}>
      {/* Language switcher at top right */}
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <div className="lang-toggle">
          <button className={`lang-toggle-option ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>EN</button>
          <button className={`lang-toggle-option ${lang === 'hi' ? 'active' : ''}`} onClick={() => changeLang('hi')}>हि</button>
        </div>
      </div>

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, background: 'var(--accent)',
          borderRadius: 18, display: 'grid', placeItems: 'center',
          fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 800,
          color: 'var(--bg-0)', margin: '0 auto 14px',
        }}>B</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Bhada
        </div>
        <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          Fast, reliable parcel delivery
        </div>
      </div>

      {/* Card */}
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div
          id="recaptcha-container"
          style={{
            marginBottom: step === 'phone' ? 16 : 0,
            display: 'flex', justifyContent: 'center',
            height: step === 'otp' ? 0 : undefined, overflow: 'hidden',
          }}
        />

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                {t('welcomeBack')}
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{t('enterMobile')}</div>
            </div>

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">{t('mobileNumber')}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute', left: 12, zIndex: 1,
                  fontSize: 15, color: 'var(--text-1)',
                  fontFamily: 'var(--font-mono)', pointerEvents: 'none', userSelect: 'none',
                }}>+91</span>
                <input
                  className="input" type="tel" inputMode="numeric"
                  placeholder="98765 43210" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{ paddingLeft: 44 }} autoFocus
                />
              </div>
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>⚠ {error}</div>}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? t('sending') : t('sendOtp')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div style={{ marginBottom: 20 }}>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, padding: '4px 0' }} onClick={handleBack}>
                {t('back')}
              </button>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                {t('enterOtp')}
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
                {t('sentTo')} <span style={{ color: 'var(--text-0)' }}>{displayPhone}</span>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">{t('sixDigitOtp')}</label>
              <input
                className="input" type="text" inputMode="numeric"
                pattern="[0-9]*" maxLength={6} placeholder="000000" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                autoFocus
              />
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>⚠ {error}</div>}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? t('verifying') : t('verifyLogin')}
            </button>
          </form>
        )}
      </div>

      <div style={{ color: 'var(--text-2)', fontSize: 11, marginTop: 24, textAlign: 'center' }}>
        {t('terms')}
      </div>
    </div>
  );
}