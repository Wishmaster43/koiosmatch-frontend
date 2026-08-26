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
import { Mono } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'

// Two-phase inline create view: the subscription form, then a one-time secret reveal that is never persisted client-side.
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

  // Copies the one-time signing secret to the clipboard and flashes a copied confirmation for 2s.
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
        <Button variant="secondary" onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={13} /> {t('common.back')}
        </Button>
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
                  <Mono as="code" style={{ flex: 1, fontSize: 12, background: 'var(--surface)', border: tintBorder('var(--color-success)'), borderRadius: 6, padding: '9px 11px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{result.secret}</Mono>
                  {/* HUISSTIJL-1 necessity: success-tinted action, no Button variant covers a success-tinted border/text pairing (only primary/secondary/ghost/soft/danger/dangerSoft exist). */}
                  <button onClick={copySecret} aria-label={t('webhooks.outgoing.copySecret')}
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- state-carrying success accent (secret-copy confirmation); Button has no success-tint variant
                    style={{ height: BTN_H, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: tintBorder('var(--color-success)'), borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success-text)', whiteSpace: 'nowrap' }}>
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('webhooks.outgoing.copySecret')}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-success-text)', marginTop: 8, marginBottom: 0 }}>{t('webhooks.outgoing.signingHint')}</p>
              </CalloutBox>
            </div>
            <Button variant="primary" onClick={onBack}>
              {t('webhooks.outgoing.done')}
            </Button>
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
              <input
                id="wh-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('webhooks.outgoing.urlPlaceholder')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the input element itself must carry the font; the Mono atom renders a separate element and cannot apply to native input text
                style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label style={labelStyle}>{t('webhooks.outgoing.field.events')}</label>
              <EventCatalog value={events} onChange={setEvents} />
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('webhooks.outgoing.createError')}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="primary" onClick={submit} disabled={saving || !canSubmit}>
                {saving ? t('webhooks.outgoing.creating') : t('webhooks.outgoing.create')}
              </Button>
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
