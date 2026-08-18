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
import CalloutBox from '@/components/ui/CalloutBox'
import { BTN_H } from '@/config/buttonMetrics'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'

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

  // Canon field style (G33/fieldMetrics) — was its own height-38/padding-11 copy
  // (one of only two 38px outliers on the whole platform; 34 is the majority).
  const inputStyle = fieldInputStyle
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, display: 'block' }

  return (
    <div>
      {/* Header: back + icon + title (mirrors WebhookDetail) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <button onClick={onBack} aria-label={t('common.back')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> {t('common.back')}
        </button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Webhook size={16} style={{ color: 'var(--color-primary-text)' }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('webhooks.outgoing.createTitle')}</h2>
      </div>

      {/* Form / secret reveal, capped to a comfortable reading width */}
      <div style={{ maxWidth: 760 }}>
        {result ? (
          // Phase 2 — one-time signing secret reveal.
          <div>
            <div style={{ marginBottom: 16 }}>
              <CalloutBox variant="success" title={t('webhooks.outgoing.secretOnce')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)', borderRadius: 6, padding: '9px 11px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{result.secret}</code>
                  <button onClick={copySecret} aria-label={t('webhooks.outgoing.copySecret')}
                    style={{ height: BTN_H, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('webhooks.outgoing.copySecret')}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 8, marginBottom: 0 }}>{t('webhooks.outgoing.signingHint')}</p>
              </CalloutBox>
            </div>
            <button onClick={onBack}
              style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: 'pointer' }}>
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

            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={saving || !canSubmit}
                style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
                {saving ? t('webhooks.outgoing.creating') : t('webhooks.outgoing.create')}
              </button>
              <Button variant="secondary" onClick={onBack}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
