import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Lightbulb, Bug, ThumbsUp, Send, CheckCircle } from 'lucide-react';
import { feedbackAPI } from '../services/api';

const TYPES = [
  { key: 'FEEDBACK',    label: 'Feedback',    icon: MessageSquare, color: 'var(--accent)',  desc: 'General feedback about your experience' },
  { key: 'SUGGESTION',  label: 'Suggestion',  icon: Lightbulb,     color: '#f59e0b',        desc: 'Ideas to improve our service' },
  { key: 'BUG_REPORT',  label: 'Bug Report',  icon: Bug,           color: 'var(--red)',     desc: 'Something is broken or not working' },
  { key: 'COMPLIMENT',  label: 'Compliment',  icon: ThumbsUp,      color: 'var(--green)',   desc: 'Share something you loved' },
];

const CATEGORIES = [
  { key: 'APP',       label: '📱 App'       },
  { key: 'DELIVERY',  label: '📦 Delivery'  },
  { key: 'RIDER',     label: '🛵 Rider'     },
  { key: 'PRICING',   label: '💰 Pricing'   },
  { key: 'SUPPORT',   label: '🎧 Support'   },
  { key: 'OTHER',     label: '✦ Other'      },
];

export default function FeedbackPage() {
  const navigate  = useNavigate();
  const [type,     setType]     = useState('FEEDBACK');
  const [category, setCategory] = useState('APP');
  const [message,  setMessage]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,     setDone]     = useState(false);
  const [toast,    setToast]    = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 5) {
      showToast('Please write at least 5 characters');
      return;
    }
    setSubmitting(true);
    try {
      await feedbackAPI.submit({ type, category, message: message.trim() });
      setDone(true);
    } catch (e) {
      showToast('✗ Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = TYPES.find(t => t.key === type);

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
        <div className="page-header">
          <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div className="page-title">Feedback</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-32) var(--sp-16)', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--green-dim)', display: 'grid', placeItems: 'center', marginBottom: 'var(--sp-20)',
          }}>
            <CheckCircle size={36} style={{ color: 'var(--green)' }} />
          </div>
          <div className="title-lg" style={{ marginBottom: 'var(--sp-8)' }}>Thank you! 🙏</div>
          <div className="body-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280, marginBottom: 'var(--sp-32)' }}>
            Your {type.toLowerCase().replace('_', ' ')} has been submitted. We review every submission and use it to make our service better.
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Home
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 'var(--sp-8)' }} onClick={() => { setDone(false); setMessage(''); }}>
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Toast */}
      {toast && (
        <div className="toast-stack">
          <div className={`toast ${toast.startsWith('✗') ? 'alert-error' : 'alert-success'}`}>{toast}</div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="page-title">Feedback & Suggestions</div>
          <div className="page-subtitle">Help us improve</div>
        </div>
      </div>

      <div style={{ padding: 'var(--sp-16)' }}>

        {/* Type picker */}
        <div style={{ marginBottom: 'var(--sp-20)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>What would you like to share?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)' }}>
            {TYPES.map(({ key, label, icon: Icon, color, desc }) => (
              <button
                key={key}
                onClick={() => setType(key)}
                style={{
                  background: type === key ? `color-mix(in srgb, ${color} 12%, var(--bg-elevated))` : 'var(--bg-surface)',
                  border: `1.5px solid ${type === key ? color : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: 'var(--sp-12)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} style={{ color, marginBottom: 6 }} />
                <div style={{ fontWeight: 700, fontSize: 13, color: type === key ? color : 'var(--text-primary)', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 'var(--sp-20)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-6)' }}>
            {CATEGORIES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`filter-chip ${category === key ? 'active' : ''}`}
                style={{ fontSize: 12 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: 'var(--sp-24)' }}>
          <div className="label-sm" style={{ marginBottom: 'var(--sp-10)' }}>
            Your {selectedType?.label}
          </div>
          <textarea
            className="input"
            placeholder={
              type === 'SUGGESTION' ? 'Describe your idea in detail…' :
              type === 'BUG_REPORT' ? 'Describe what happened and how to reproduce it…' :
              type === 'COMPLIMENT' ? 'Tell us what you loved…' :
              'Share your thoughts about our service…'
            }
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            maxLength={1000}
            style={{ width: '100%', resize: 'vertical', fontSize: 14, lineHeight: 1.6, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-6)' }}>
            <span style={{ fontSize: 11, color: message.length < 5 && message.length > 0 ? 'var(--red)' : 'var(--text-tertiary)' }}>
              {message.length < 5 && message.length > 0 ? 'Too short (min 5 chars)' : ''}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {message.length}/1000
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          className="btn btn-primary btn-full"
          disabled={submitting || message.trim().length < 5}
          onClick={handleSubmit}
          style={{ gap: 8 }}
        >
          {submitting
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} /> Submitting…</>
            : <><Send size={15} /> Submit {selectedType?.label}</>
          }
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--sp-16)', lineHeight: 1.5 }}>
          Your feedback goes directly to our team and is reviewed within 48 hours.
        </p>
      </div>
    </div>
  );
}