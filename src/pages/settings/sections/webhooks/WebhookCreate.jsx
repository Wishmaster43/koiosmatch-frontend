/**
 * WebhookCreate — inline "new subscription" view (replaces the list, like
 * WebhookDetail). No modal: name + URL + event filter render full-width on the
 * page for readability. Two phases: (1) the form, (2) the one-time signing-secret
 * reveal. The secret is never persisted client-side.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Copy, Webhook } from 'lucide-react'
import { createSubscription } from './webhooksApi'
import EventCatalog from './EventCatalog'

export default function WebhookCreate({ onBack, onCreated }) {
  const { t } = useTranslation('settings')
  const [name, setName]     = useState('')
  const [url, setUrl]       = useState('')
  const [events, setEvents] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)
  const [result, setResult] = useState(null)   // { ...sub, secret } after create
  const [copied, setCopied] = useState(false)
  const firstField          = useRef(null)

  // Focus the name field on open.
  useEffect(() => { firstField.current?.focus() }, [])

  // A subscription needs a name, an https URL and at least one event.
  const canSubmit = name.trim() && /^https?:\/\//i.test(url.trim()) && events.length > 0

  // Submit the form; on success move to the secret-reveal phase and notify the list.
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

  const copySecret = () => {
    navigator.clipboard.writeText(result?.secret ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle = { width: '100%', height: 38, padding: '0 11px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, display: 'block' }

  return (
    <div>
      {/* Header: back + icon + title (mirrors WebhookDetail) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <button onClick={onBack} aria-label={t('common.back')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> {t('common.back')}
        </button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Webhook size={16} style={{ color: 'var(--color-primary)' }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('webhooks.outgoing.createTitle')}</h2>
      </div>

      {/* Form / secret reveal, capped to a comfortable reading width */}
      <div style={{ maxWidth: 760 }}>
        {result ? (
          // Phase 2 — one-time signing secret reveal.
          <div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{t('webhooks.outgoing.secretOnce')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid #BBF7D0', borderRadius: 6, padding: '9px 11px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{result.secret}</code>
                <button onClick={copySecret} aria-label={t('webhooks.outgoing.copySecret')}
                  style={{ height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid #BBF7D0', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('webhooks.outgoing.copySecret')}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#166534', marginTop: 8 }}>{t('webhooks.outgoing.signingHint')}</p>
            </div>
            <button onClick={onBack}
              style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              {t('webhooks.outgoing.done')}
            </button>
          </div>
        ) : (
          // Phase 1 — the create form + event filter.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label style={labelStyle}>{t('webhooks.outgoing.field.events')}</label>
              <EventCatalog value={events} onChange={setEvents} />
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('webhooks.outgoing.createError')}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={saving || !canSubmit}
                style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
                {saving ? t('webhooks.outgoing.creating') : t('webhooks.outgoing.create')}
              </button>
              <button onClick={onBack}
                style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
