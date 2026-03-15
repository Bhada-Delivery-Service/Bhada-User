import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Shield, ArrowLeft, RefreshCw, Package } from 'lucide-react';
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
  const [otp, setOtp]          = useState(['', '', '', '', '', '']);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const confirmRef             = useRef(null);
  const otpRefs                = useRef([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const id = setTimeout(() => setResendTimer(r => r - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [resendTimer]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    const normalized = normalizePhone(phone);
    if (!normalized) { setError(t('invalidPhone') || 'Enter a valid phone number'); return; }
    setLoading(true);
    try {
      confirmRef.current = await sendOTP(normalized, 'recaptcha-container');
      setStep('otp');
      setResendTimer(30);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    const otpStr = otp.join('');
    if (otpStr.length !== 6) { setError(t('enterSixDigit') || 'Enter 6-digit OTP'); return; }
    if (!confirmRef.current) { setError(t('sessionExpired') || 'Session expired. Resend OTP.'); return; }
    setLoading(true);
    try {
      const idToken = await verifyOTP(confirmRef.current, otpStr);
      await loginWithFirebase(idToken);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Verification failed.';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); otpRefs.current[5]?.focus(); }
  };

  const handleResend = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    try {
      confirmRef.current = await sendOTP(normalized, 'recaptcha-container');
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to resend');
    } finally { setLoading(false); }
  };

  const displayPhone = normalizePhone(phone) || phone;

  return (
    <div className="login-page">
      {/* Grid texture */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
      }} />

      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48,
            background: 'var(--accent)',
            borderRadius: 14,
            display: 'grid', placeItems: 'center',
            color: '#fff',
            boxShadow: '0 0 20px var(--accent-glow)',
            flexShrink: 0,
          }}>
            <Package size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Bhada
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
              DELIVERY APP
            </div>
          </div>

          {/* Language toggle */}
          <div style={{ marginLeft: 'auto' }}>
            <div className="seg-control" style={{ width: 'fit-content' }}>
              {['en', 'hi'].map(l => (
                <button key={l} className={`seg-option${lang === l ? ' active' : ''}`}
                  onClick={() => changeLang(l)} style={{ minWidth: 36 }}>
                  {l === 'en' ? 'EN' : 'हि'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 99,
              background: (step === 'otp' ? i <= 1 : i === 0) ? 'var(--accent)' : 'var(--bg-subtle)',
              transition: 'background 0.3s ease',
              boxShadow: (step === 'otp' ? i <= 1 : i === 0) ? '0 0 8px var(--accent-glow)' : 'none',
            }} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Phone */}
        {step === 'phone' && (
          <div style={{ animation: 'slideUp 0.22s ease' }}>
            <div id="recaptcha-container" />
            <h1 style={{ fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.03em' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
              {t('enterPhone') || 'Enter your phone number to receive an OTP'}
            </p>
            <form onSubmit={handleSendOTP}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input
                    className="input"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    style={{ paddingLeft: 38 }}
                    autoFocus required
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  10-digit numbers get +91 automatically
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !phone.trim()}>
                {loading
                  ? <><div className="loader-sm" style={{ borderTopColor: '#fff' }} /> Sending OTP...</>
                  : <><Phone size={15} /> Send OTP</>
                }
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: OTP */}
        {step === 'otp' && (
          <div style={{ animation: 'slideUp 0.22s ease' }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: 16, padding: '4px 0', color: 'var(--text-secondary)' }}
              onClick={() => { setStep('phone'); setOtp(['','','','','','']); setError(''); confirmRef.current = null; }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h1 style={{ fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.03em' }}>
              Enter OTP
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
              {t('sentTo') || 'Sent to'}{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{displayPhone}</strong>
            </p>
            <form onSubmit={handleVerifyOTP}>
              <div
                style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '0 0 28px' }}
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text" inputMode="numeric" maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    style={{
                      width: 46, height: 54, textAlign: 'center',
                      fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      background: digit ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${digit ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, color: digit ? 'var(--accent)' : 'var(--text-primary)',
                      outline: 'none', transition: 'all 0.15s ease', caretColor: 'var(--accent)',
                    }}
                  />
                ))}
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading || otp.join('').length !== 6}>
                {loading
                  ? <><div className="loader-sm" style={{ borderTopColor: '#fff' }} /> Verifying...</>
                  : <><Shield size={15} /> Verify &amp; Sign In</>
                }
              </button>
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                {resendTimer > 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Resend in{' '}
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {resendTimer}s
                    </span>
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleResend} disabled={loading}
                    style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <RefreshCw size={12} /> Resend OTP
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
