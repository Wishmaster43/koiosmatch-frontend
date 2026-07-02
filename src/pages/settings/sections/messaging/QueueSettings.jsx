/**
 * QueueSettings — WhatsApp-privé queue config: (1) the send rate per number and
 * (2) the message-type classification whose drag-order = send priority (top first).
 * The rate falls back to a seed default until the backend endpoint exists (C-43).
 * Endpoints: GET/PUT /settings/whatsapp-queue · /whatsapp-message-types (via StatusListEditor).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { getQueueConfig, putQueueConfig } from './messagingApi'
import StatusListEditor from '../StatusListEditor'

const DEFAULT_RATE = 20 // seed: max privé-messages per hour per number, until C-43 lands

export default function QueueSettings() {
  const { t } = useTranslation('settings')
  const [rate, setRate]       = useState(DEFAULT_RATE)
  const [savedRate, setSaved0] = useState(DEFAULT_RATE) // last-persisted value
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  // Load the per-number hourly rate; fall back to the seed default before C-43 exists.
  useEffect(() => {
    getQueueConfig()
      .then((d) => {
        const v = Number(d?.per_number_hourly_limit ?? d?.rate ?? DEFAULT_RATE) || DEFAULT_RATE
        setRate(v); setSaved0(v)
      })
      .catch(() => { setRate(DEFAULT_RATE); setSaved0(DEFAULT_RATE) })
  }, [])

  const dirty = rate !== savedRate

  // Persist the rate; best-effort until the endpoint exists.
  const save = async () => {
    setSaving(true)
    try {
      await putQueueConfig({ per_number_hourly_limit: rate })
      setSaved0(rate); setSaved(true); setTimeout(() => setSaved(false), 1800)
    } catch { /* noop — endpoint may not exist yet (C-43) */ }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('messaging.queue.subtitle')}</p>

      {/* Rate-limit per number — protects the number from being blocked */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t('messaging.queue.rateLabel')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('messaging.queue.rateHelp')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={1} value={rate} onChange={(e) => setRate(Math.max(1, Number(e.target.value)))}
              aria-label={t('messaging.queue.rateLabel')}
              style={{ width: 90, height: 34, padding: '0 10px', fontSize: 14, fontWeight: 600, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('messaging.queue.rateUnit')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={save} disabled={!dirty || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, cursor: dirty && !saving ? 'pointer' : 'default', opacity: dirty || saved ? 1 : 0.55, background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
            {saved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
          </button>
        </div>
      </div>

      {/* Message-type classification — the drag-order IS the send priority (rank shown explicitly) */}
      <StatusListEditor
        title={t('messaging.queue.typesTitle')}
        subtitle={t('messaging.queue.typesSubtitle')}
        endpoint="/whatsapp-message-types"
        addLabel={t('messaging.queue.typesAdd')}
        withColor compact showRank />
    </div>
  )
}
