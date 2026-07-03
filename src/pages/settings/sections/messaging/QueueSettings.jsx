/**
 * QueueSettings — WhatsApp-privé queue config:
 *  (1) send rate-limits, split by recipient familiarity — KNOWN contacts (existing
 *      conversation) get a generous hourly cap; NEW/unknown numbers are strictly
 *      throttled per hour/day/week (this is what protects the number from bans);
 *  (2) the message-type classification whose drag-order / rank = send priority.
 * The queue drains within these limits, highest-priority type first (BE: WA-1..WA-4).
 * Endpoints: GET/PUT /settings/whatsapp-queue · /whatsapp-message-types (StatusListEditor).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { getQueueConfig, putQueueConfig } from './messagingApi'
import StatusListEditor from '../StatusListEditor'

// Seed defaults until the backend endpoint exists (C-43 / WA-4). Known = generous;
// new-number caps are conservative on purpose (WhatsApp bans cold outreach hardest).
const DEFAULTS = {
  known_hourly_limit: 1000,
  new_hourly_limit:   20,
  new_daily_limit:    50,
  new_weekly_limit:   200,
}

// Read a positive integer from the response, else the seed default.
const num = (v, d) => (Number(v) > 0 ? Math.round(Number(v)) : d)

export default function QueueSettings() {
  const { t } = useTranslation('settings')
  const [cfg,   setCfg]    = useState(DEFAULTS)
  const [saved0, setSaved0] = useState(DEFAULTS) // last-persisted snapshot
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  // Load the queue limits; fall back to the seed defaults before the endpoint exists.
  useEffect(() => {
    getQueueConfig()
      .then((d) => {
        const next = {
          // legacy per_number_hourly_limit maps onto the known-contact cap.
          known_hourly_limit: num(d?.known_hourly_limit ?? d?.per_number_hourly_limit, DEFAULTS.known_hourly_limit),
          new_hourly_limit:   num(d?.new_hourly_limit, DEFAULTS.new_hourly_limit),
          new_daily_limit:    num(d?.new_daily_limit,  DEFAULTS.new_daily_limit),
          new_weekly_limit:   num(d?.new_weekly_limit, DEFAULTS.new_weekly_limit),
        }
        setCfg(next); setSaved0(next)
      })
      .catch(() => { setCfg(DEFAULTS); setSaved0(DEFAULTS) })
  }, [])

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved0)
  const setField = (k, v) => setCfg((c) => ({ ...c, [k]: Math.max(1, Math.round(Number(v) || 1)) }))

  // Persist all limits; best-effort until the endpoint exists (C-43 / WA-4).
  const save = async () => {
    setSaving(true)
    try {
      await putQueueConfig(cfg)
      setSaved0(cfg); setSaved(true); setTimeout(() => setSaved(false), 1800)
    } catch { /* noop — endpoint may not exist yet */ }
    setSaving(false)
  }

  // One labelled number input (label above, unit right). Plain render function, NOT a
  // nested component — a component defined in render remounts each keystroke (focus loss).
  const limitField = (field, unit) => (
    <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>
      <input type="number" min={1} value={cfg[field]} onChange={(e) => setField(field, e.target.value)}
        aria-label={unit}
        style={{ width: '100%', height: 34, padding: '0 10px', fontSize: 14, fontWeight: 600, textAlign: 'right',
                 fontFamily: "'JetBrains Mono', monospace", border: '1px solid var(--border)', borderRadius: 8,
                 outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
    </label>
  )

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14 }
  const cardTitle = { fontSize: 13, fontWeight: 600, color: 'var(--text)' }
  const cardHelp  = { fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 12, maxWidth: 460 }

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('messaging.queue.subtitle')}</p>

      {/* KNOWN contacts — generous hourly cap (low ban risk). */}
      <div style={card}>
        <div style={cardTitle}>{t('messaging.queue.knownTitle')}</div>
        <div style={cardHelp}>{t('messaging.queue.knownHelp')}</div>
        <div style={{ maxWidth: 200 }}>
          {limitField('known_hourly_limit', t('messaging.queue.perHour'))}
        </div>
      </div>

      {/* NEW / unknown numbers — the strict anti-ban caps per hour / day / week. */}
      <div style={card}>
        <div style={cardTitle}>{t('messaging.queue.newTitle')}</div>
        <div style={cardHelp}>{t('messaging.queue.newHelp')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {limitField('new_hourly_limit', t('messaging.queue.perHour'))}
          {limitField('new_daily_limit',  t('messaging.queue.perDay'))}
          {limitField('new_weekly_limit', t('messaging.queue.perWeek'))}
        </div>
      </div>

      {/* Save all limits at once. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
        <button onClick={save} disabled={!dirty || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500,
                   border: 'none', borderRadius: 8, cursor: dirty && !saving ? 'pointer' : 'default', opacity: dirty || saved ? 1 : 0.55,
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('messaging.queue.limitsSaved')}</>
          : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</>
          : <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>

      {/* Message-type classification — the drag-order / rank IS the send priority. */}
      <StatusListEditor
        title={t('messaging.queue.typesTitle')}
        subtitle={t('messaging.queue.typesSubtitle')}
        endpoint="/whatsapp-message-types"
        addLabel={t('messaging.queue.typesAdd')}
        withColor compact showRank />
    </div>
  )
}
