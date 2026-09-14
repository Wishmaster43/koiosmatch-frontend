/**
 * WebhookCreate — inline "new subscription" view (replaces the list, like
 * WebhookDetail). No modal: name + URL + event filter render full-width on the
 * page for readability. Two phases: (1) the form, (2) the one-time signing-secret
 * reveal. The secret is never persisted client-side.
 */
import { useState, useRef, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Webhook } from 'lucide-react'
import { createSubscription } from './webhooksApi'
import EventCatalog from './EventCatalog'
import OneTimeSecretReveal from '@/pages/settings/components/OneTimeSecretReveal'
import SettingsDetailHeader from '@/pages/settings/components/SettingsDetailHeader'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { formLabelStyle } from '@/components/ui/typography'
import { useCreateForm } from '@/pages/settings/lib/useCreateForm'

// hand-written: the spec carries no 2xx schema for POST /webhook-subscriptions
interface WebhookSubscriptionCreated {
  id: string
  name?: string
  url?: string
  events?: string[]
  signing_secret?: string
  secret?: string
}

interface WebhookCreateProps {
  /** Returns to the list view without creating anything. */
  onBack: () => void
  /** Called once the subscription is created, so the parent list can add the row. */
  onCreated?: (created: WebhookSubscriptionCreated) => void
}

// Two-phase inline create view: the subscription form, then a one-time secret reveal that is never persisted client-side.
export default function WebhookCreate({ onBack, onCreated }: WebhookCreateProps) {
  const { t } = useTranslation('settings')
  const [name, setName]     = useState('')
  const [url, setUrl]       = useState('')
  const [events, setEvents] = useState<string[]>([])
  const { saving, setSaving, error, setError, result, setResult } = useCreateForm<WebhookSubscriptionCreated>()
  const firstField          = useRef<HTMLInputElement>(null)

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
      const created = await createSubscription({ name: name.trim(), url: url.trim(), events })
      setResult(created)
      onCreated?.(created)
    } catch {
      setError(true)
    }
    setSaving(false)
  }

  // Canon field style (G33/fieldMetrics) — was its own height-38/padding-11 copy
  // (one of only two 38px outliers on the whole platform; 34 is the majority).
  const inputStyle = fieldInputStyle
  // Shared FormLabel identity (12/500/muted) + this file's own layout (§4: identity from the atom, layout local).
  const labelStyle = { ...formLabelStyle, marginBottom: 5, display: 'block' }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <SettingsDetailHeader
          onBack={onBack}
          backLabel={t('common.back')}
          icon={Webhook}
          title={t('webhooks.outgoing.createTitle')}
        />
      </div>

      {/* Form / secret reveal, capped to a comfortable reading width */}
      <div style={{ maxWidth: 760 }}>
        {result ? (
          // Phase 2 — one-time signing secret reveal (shared with ApiKeyCreate).
          // The backend returns the key as signing_secret; secret is a legacy fallback.
          <OneTimeSecretReveal
            title={t('webhooks.outgoing.secretOnce')}
            secret={result.signing_secret ?? result.secret ?? ''}
            hint={t('webhooks.outgoing.signingHint')}
            copyLabel={t('webhooks.outgoing.copySecret')}
            copiedLabel={t('common.copied')}
            doneLabel={t('webhooks.outgoing.done')}
            onDone={onBack}
          />
        ) : (
          // Phase 1 — the create form + event filter.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle} htmlFor="wh-name">{t('webhooks.outgoing.field.name')}</label>
              <input id="wh-name" ref={firstField} value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder={t('webhooks.outgoing.namePlaceholder')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="wh-url">{t('webhooks.outgoing.field.url')}</label>
              <input
                id="wh-url"
                value={url}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
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
