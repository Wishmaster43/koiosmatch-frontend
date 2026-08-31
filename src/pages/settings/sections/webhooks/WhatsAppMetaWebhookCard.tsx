/**
 * WhatsAppMetaWebhookCard — the read-only "WhatsApp (Meta)" block on the
 * Incoming webhooks tab (Danny 31-08: "waar stel ik dat in?"). Shows the ONE
 * app-level Meta callback URL (the server answers hub.challenge itself — the
 * old Make scenario is obsolete), the per-connection verify-token status
 * (has_verify_token only — the secret itself is never readable, audit-les
 * 22-08 #1) and the registration steps. The agent webhook URLs are Koios-
 * internal and deliberately NOT shown here as Meta targets.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X as XIcon } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import Button from '@/components/ui/Button'
import CopyIconButton from '@/components/ui/CopyIconButton'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

// One URL for GET (verify) and POST (messages); tenants resolve per payload.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'
const CALLBACK_URL = `${API_URL}/whatsapp/webhook`

// Read-only info card: callback URL + copy, token status per connection, steps.
export default function WhatsAppMetaWebhookCard() {
  const { t } = useTranslation('settings')
  const [connections, setConnections] = useState<WhatsappConnectionRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Light list fetch for the has-token flags; alive guard per §9.
  useEffect(() => {
    let alive = true
    api.get('/whatsapp').then((res) => {
      if (!alive) return
      setConnections(unwrapList<WhatsappConnectionRow>(res).rows)
      setLoadState('ready')
    }).catch(() => { if (alive) setLoadState('error') })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 24, maxWidth: 640 }}>
      <SectionTitle>{t('webhooks.meta.title')}</SectionTitle>
      <Caption as="p" style={{ marginTop: 2, marginBottom: 10 }}>{t('webhooks.meta.subtitle')}</Caption>

      {/* The one app-level callback URL, copy-ready. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Mono style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CALLBACK_URL}</Mono>
        <CopyIconButton value={CALLBACK_URL} label={t('webhooks.meta.copyUrl')} copiedLabel={t('webhooks.meta.copied')} />
      </div>

      {/* Verify-token status per connection — never the value itself. */}
      {loadState === 'error' && <Caption as="p" style={{ color: 'var(--color-danger-text)' }}>{t('webhooks.meta.loadError')}</Caption>}
      {loadState === 'ready' && connections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {connections.map((c) => (
            <Caption key={c.id} as="div" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {c.has_verify_token
                ? <Check size={12} style={{ color: 'var(--color-success-text)' }} role="img" aria-label={t('webhooks.meta.tokenSet')} />
                : <XIcon size={12} style={{ color: 'var(--color-danger-text)' }} role="img" aria-label={t('webhooks.meta.tokenMissing')} />}
              <span>{c.label ?? c.waba_id}</span>
              <span>{c.has_verify_token ? t('webhooks.meta.tokenSet') : t('webhooks.meta.tokenMissing')}</span>
            </Caption>
          ))}
        </div>
      )}

      {/* Registration steps — app-level, one time; agent URLs stay internal. */}
      <Caption as="p" style={{ margin: 0 }}>{t('webhooks.meta.stepApp')}</Caption>
      <Caption as="p" style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {t('webhooks.meta.stepToken')}
        <Button href="#settings/whatsapp/whatsapp" variant="ghost" size="sm">{t('webhooks.meta.tokenLink')}</Button>
      </Caption>
      <Caption as="p" style={{ margin: '4px 0 0' }}>{t('webhooks.meta.stepAgent')}</Caption>
    </div>
  )
}
