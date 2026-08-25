/**
 * WaWebQueueLimits — Settings → WhatsApp → WhatsApp Web numbers, queue-limits
 * card (K-193 WA-6a/G-12/C-43). Reads/writes the tenant's recipient-familiarity
 * send caps: a generous hourly cap for KNOWN contacts, and strict hourly/daily/
 * weekly caps for NEW numbers (cold outreach is what gets a device banned).
 * `GET|PUT /settings/whatsapp-queue` (settings.view / settings.update),
 * fields exactly `known_hourly_limit | new_hourly_limit | new_daily_limit |
 * new_weekly_limit` (WhatsappQueueConfigController).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { FieldRow, TextField } from '@/components/forms/fields'
import SaveButton from '@/components/ui/SaveButton'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import { Caption, Mono, SectionTitle } from '@/components/ui/typography'

// The exact four keys the controller accepts — never invent a fifth.
type QueueLimits = {
  known_hourly_limit?: number
  new_hourly_limit?: number
  new_daily_limit?: number
  new_weekly_limit?: number
}
const FIELDS: Array<keyof QueueLimits> = ['known_hourly_limit', 'new_hourly_limit', 'new_daily_limit', 'new_weekly_limit']
type Phase = 'loading' | 'ready' | 'error'

// `canManage` gates the fields/Save behind settings.update — the backend PUT is
// settings.update-only, so a settings.view-only role (planner, recruiter, manager)
// gets read-only values and no Save, never a form whose Save silently 403s.
export default function WaWebQueueLimits({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('settings')
  const [values, setValues] = useState<QueueLimits>({})
  const [phase, setPhase] = useState<Phase>('loading')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the current tenant caps (or the code defaults the controller falls back to).
  useEffect(() => {
    let alive = true
    api.get('/settings/whatsapp-queue')
      .then(res => { if (alive) { setValues(unwrap<QueueLimits>(res) ?? {}); setPhase('ready') } })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [])

  // Any edit clears the saved-state pastel so the button reflects a dirty form again.
  const handleChange = (field: keyof QueueLimits, raw: string) => {
    setSaved(false)
    setError(null)
    const n = raw === '' ? undefined : Number(raw)
    setValues(prev => ({ ...prev, [field]: Number.isNaN(n) ? prev[field] : n }))
  }

  // PUT the whole set (all four are `sometimes`, so it is safe to send them all).
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await api.put('/settings/whatsapp-queue', values)
      setValues(unwrap<QueueLimits>(res) ?? values)
      setSaved(true)
    } catch (e) {
      setError(extractApiError(e, t('whatsappWeb.queue.saveError'), {
        known_hourly_limit: t('whatsappWeb.queue.knownHourly'),
        new_hourly_limit: t('whatsappWeb.queue.newHourly'),
        new_daily_limit: t('whatsappWeb.queue.newDaily'),
        new_weekly_limit: t('whatsappWeb.queue.newWeekly'),
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 16, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <SectionTitle style={{ marginBottom: 4, display: 'block' }}>{t('whatsappWeb.queue.title')}</SectionTitle>
      <Caption style={{ marginBottom: 12, display: 'block' }}>{t('whatsappWeb.queue.intro')}</Caption>

      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <Spinner size={16} /> <Caption>{t('whatsappWeb.queue.loading')}</Caption>
        </div>
      )}

      {phase === 'error' && <CalloutBox variant="danger">{t('whatsappWeb.queue.loadError')}</CalloutBox>}

      {phase === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Read-only rendering when the viewer lacks settings.update — plain
              values, no editable field and no Save (§3 no fake affordance). */}
          {!canManage && <Caption>{t('whatsappWeb.queue.readOnlyNote')}</Caption>}
          {FIELDS.map(field => (
            <FieldRow key={field} label={t(`whatsappWeb.queue.${camel(field)}`)}>
              {canManage
                ? <TextField type="number" value={values[field] != null ? String(values[field]) : ''}
                    onChange={v => handleChange(field, v)} placeholder="0" />
                : <Mono>{values[field] != null ? String(values[field]) : '—'}</Mono>}
            </FieldRow>
          ))}
          {canManage && error && <CalloutBox variant="danger">{error}</CalloutBox>}
          {canManage && (
            <div>
              <SaveButton size="sm" saved={saved} disabled={saving || saved} onClick={handleSave}>
                {saving ? <Spinner size={13} /> : null}
                {saved ? t('whatsappWeb.queue.saved') : t('whatsappWeb.queue.save')}
              </SaveButton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// snake_case field key -> the i18n key suffix (knownHourlyLimit stays too verbose;
// the four keys map 1:1 to short, hand-picked labels instead of a generic transform).
function camel(field: keyof QueueLimits): string {
  const MAP: Record<keyof QueueLimits, string> = {
    known_hourly_limit: 'knownHourly',
    new_hourly_limit: 'newHourly',
    new_daily_limit: 'newDaily',
    new_weekly_limit: 'newWeekly',
  }
  return MAP[field]
}
