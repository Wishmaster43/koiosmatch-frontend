/**
 * WebhookCreateModal — create an outgoing subscription, then reveal its signing
 * secret exactly once. Two phases in one dialog: (1) name + URL + event filter,
 * (2) the one-time secret reveal. The secret is never persisted client-side.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, X } from 'lucide-react'
import { createSubscription } from './webhooksApi'
import EventCatalog from './EventCatalog'

export default function WebhookCreateModal({ onClose, onCreated }) {
  const { t } = useTranslation('settings')
  const [name, setName]       = useState('')
  const [url, setUrl]         = useState('')
  const [events, setEvents]   = useState([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(false)
  const [result, setResult]   = useState(null)   // { ...sub, secret } after create
  const [copied, setCopied]   = useState(false)
  const firstField            = useRef(null)

  // Focus the first field on open and close on Escape (basic dialog a11y).
  useEffect(() => {
    firstField.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && !result) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, result])

  // A subscription needs a name, an https URL and at least one event.
  const canSubmit = name.trim() && /^https?:\/\//i.test(url.trim()) && events.length > 0

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(false)
    try {
      const created = await createSubscription({ name: name.trim(), url: url.trim(), event_types: events })
      setResult(created)
      onCreated?.(created)
    } catch {
      setError(true)
    }
    setSaving(false)
  }

  const copySecret = () => { navigator.clipboard.writeText(result?.secret ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const inputStyle = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }

  return (
    <div role="presentation" onClick={() => !result && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={t('webhooks.outgoing.createTitle')} onClick={(e) => e.stopPropagation()}
        style={{ width: 540, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('webhooks.outgoing.createTitle')}</h2>
          <button onClick={onClose} aria-label={t('common.cancel')}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, background: 'var(--hover-bg)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>

        {result ? (
          // Phase 2 — one-time signing secret reveal.
          <div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{t('webhooks.outgoing.secretOnce')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{result.secret}</code>
                <button onClick={copySecret} style={{ height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid #BBF7D0', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('webhooks.outgoing.copySecret')}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#166534', marginTop: 8 }}>{t('webhooks.outgoing.signingHint')}</p>
            </div>
            <button onClick={onClose} style={{ width: '100%', height: 38, fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              {t('webhooks.outgoing.done')}
            </button>
          </div>
        ) : (
          // Phase 1 — the create form + event filter.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="wh-name">{t('webhooks.outgoing.field.name')}</label>
              <input id="wh-name" ref={firstField} value={name} onChange={(e) => setName(e.target.value)}
                placeholder={t('webhooks.outgoing.namePlaceholder')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="wh-url">{t('webhooks.outgoing.field.url')}</label>
              <input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder={t('webhooks.outgoing.urlPlaceholder')} style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />
            </div>
            <div>
              <label style={labelStyle}>{t('webhooks.outgoing.field.events')}</label>
              <EventCatalog value={events} onChange={setEvents} />
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('webhooks.outgoing.createError')}</div>}

            <button onClick={submit} disabled={saving || !canSubmit}
              style={{ height: 38, marginTop: 4, fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
              {saving ? t('webhooks.outgoing.creating') : t('webhooks.outgoing.create')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
