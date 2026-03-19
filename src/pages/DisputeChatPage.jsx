import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Image, RefreshCw } from 'lucide-react';
import { disputesAPI, filesAPI } from '../services/api';
import { getSocket } from '../services/socketService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}


function isImage(url) {
  if (!url) return false;
  const decoded = decodeURIComponent(url);
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(decoded);
}
function isVideo(url) {
  if (!url) return false;
  const decoded = decodeURIComponent(url);
  return /\.(mp4|mov|webm|ogg)(\?.*)?$/i.test(decoded);
}
// Encode spaces in URLs so browsers can load them (fixes legacy filenames with spaces)
function safeUrl(url) {
  if (!url) return url;
  return url.replace(/ /g, '%20');
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
function Bubble({ msg, isOwn }) {
  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 8, padding: '0 16px' }}>
      <div style={{ maxWidth: '75%' }}>
        {!isOwn && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, paddingLeft: 2 }}>
            {msg.senderName} · {msg.senderRole}
          </div>
        )}
        <div style={{
          background: isOwn ? 'var(--accent)' : 'var(--bg-surface)',
          color: isOwn ? '#fff' : 'var(--text-primary)',
          borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding: '8px 12px',
          fontSize: 13,
          border: isOwn ? 'none' : '1px solid var(--border)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}>
          {msg.text && <div style={{ lineHeight: 1.5 }}>{msg.text}</div>}
          {msg.mediaUrls?.map((url, i) => (
            <div key={i} style={{ marginTop: msg.text ? 6 : 0 }}>
              {isImage(url) ? (
                <a href={safeUrl(url)} target="_blank" rel="noreferrer">
                  <img src={safeUrl(url)} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block' }} />
                </a>
              ) : isVideo(url) ? (
                <video controls style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8 }}>
                  <source src={safeUrl(url)} />
                </video>
              ) : (
                <a href={safeUrl(url)} target="_blank" rel="noreferrer" style={{ color: isOwn ? 'rgba(255,255,255,0.85)' : 'var(--accent)', fontSize: 12 }}>
                  📎 Attachment
                </a>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, textAlign: isOwn ? 'right' : 'left', paddingRight: isOwn ? 2 : 0, paddingLeft: isOwn ? 0 : 2 }}>
          {formatTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DisputeChatPage() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const [dispute, setDispute]       = useState(null);
  const [messages, setMessages]     = useState([]);
  const [text, setText]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [mediaUrls, setMediaUrls]   = useState([]);
  const bottomRef  = useRef(null);
  const fileRef    = useRef(null);

  // Load dispute + messages
  const loadAll = async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        disputesAPI.getById(id),
        disputesAPI.getChat(id),
      ]);
      setDispute(dRes.data?.data || dRes.data);
      setMessages(cRes.data?.data || []);
    } catch {
      // silently fail – user sees empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  // Socket – real-time
  useEffect(() => {
    const socket = getSocket?.();
    if (!socket) return;

    socket.emit('dispute:chat:join', id);
    const handler = (msg) => {
      if (msg.disputeId === id) {
        setMessages(prev => prev.find(m => m.messageId === msg.messageId) ? prev : [...prev, msg]);
      }
    };
    socket.on('dispute:chat:message', handler);
    return () => {
      socket.off('dispute:chat:message', handler);
      socket.emit('dispute:chat:leave', id);
    };
  }, [id]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!text.trim() && mediaUrls.length === 0) return;
    setSending(true);
    try {
      const { data } = await disputesAPI.sendMessage(id, { text: text.trim(), mediaUrls });
      const sent = data?.data;
      // Optimistic add — socket dedup will skip it when broadcast arrives
      if (sent?.messageId) {
        setMessages(prev =>
          prev.find(m => m.messageId === sent.messageId) ? prev : [...prev, sent]
        );
      }
      setText('');
      setMediaUrls([]);
    } catch {
      // show nothing - silent fail so user can retry
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const { data } = await filesAPI.upload(file);
        return data.data.url;
      }));
      setMediaUrls(prev => [...prev, ...urls]);
    } catch {
      // silent
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isClosed = ['RESOLVED', 'REJECTED', 'CLOSED'].includes(dispute?.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button className="btn btn-ghost btn-icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title-sm">Dispute Chat</div>
          {dispute && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              #{(dispute.disputeId || id || '').slice(-10).toUpperCase()} · {dispute.status?.replace(/_/g, ' ')}
            </div>
          )}
        </div>
        <button className="btn btn-ghost btn-icon-sm" onClick={loadAll}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Dispute summary strip */}
      {dispute && (
        <div style={{ padding: '10px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            <span className="mono" style={{ fontSize: 11 }}>Order #{(dispute.orderId || '').slice(-8).toUpperCase()}</span>
            {' · '}
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{dispute.reason?.replace(/_/g, ' ')}</span>
          </div>
          {dispute.adminNote && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--blue-dim, rgba(59,130,246,0.1))', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>Admin: </span>{dispute.adminNote}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12, paddingBottom: 8 }}>
        {loading ? (
          <div className="center-box" style={{ marginTop: 40 }}><div className="spinner spinner-lg" /></div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, marginTop: 40, padding: '0 32px' }}>
            No messages yet.<br />Send a message to get in touch with the support team.
          </div>
        ) : (
          messages.map(msg => (
            <Bubble key={msg.messageId} msg={msg} isOwn={msg.senderRole !== 'admin'} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Media previews */}
      {mediaUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 16px', flexWrap: 'wrap', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          {mediaUrls.map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {isImage(url)
                ? <img src={safeUrl(url)} alt="" style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                : <div style={{ width: 50, height: 50, background: 'var(--bg-3, #eee)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>FILE</div>
              }
              <button
                onClick={() => setMediaUrls(prev => prev.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      {isClosed ? (
        <div style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          This dispute is {dispute?.status?.toLowerCase()}. Chat is no longer available.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '10px 16px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-ghost btn-icon-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Image size={16} />}
          </button>
          <textarea
            className="input input-textarea"
            style={{ flex: 1, minHeight: 40, maxHeight: 96, resize: 'none' }}
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="btn btn-primary btn-icon-sm"
            onClick={handleSend}
            disabled={sending || (!text.trim() && mediaUrls.length === 0)}
          >
            {sending ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }} /> : <Send size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}