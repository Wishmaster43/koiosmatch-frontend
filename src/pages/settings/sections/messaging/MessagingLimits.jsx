/**
 * MessagingLimits — view + edit the tenant's messaging limit. The backend caps
 * the value at a hard `ceiling`; we show that ceiling and block saving anything
 * higher (client guard; the backend re-validates). Handles loading/error states.
 *
 * Shape assumption (confirm with backend): GET → { limit, ceiling, unit? }.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { getLimits, putLimits } from './messagingApi'

export default function MessagingLimits() {
  const { t } = useTranslation('settings')
  const [data, setData]     = useState(null)
  const [phase, setPhase]   = useState('loading')   // loading | error | ready
  const [value, setValue]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  // Load the current limit + ceiling; tolerate a couple of field-name variants.
  useEffect(() => {
    getLimits()
      .then((d) => {
        const limit = d?.limit ?? d?.value ?? d?.daily_limit ?? 0
        setData(d ?? {})
        setValue(Number(limit) || 0)
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
  }, [])

  const ceiling = data?.ceiling ?? data?.max ?? data?.hard_limit ?? null
  const unit = data?.unit ?? t('messaging.limits.unit')
  const overCeiling = ceiling != null && value > ceiling
  const dirty = data && value !== (data.limit ?? data.value ?? data.daily_limit ?? 0)

  const save = async () => {
    if (overCeiling) return
    setSaving(true)
    try {
      const updated = await putLimits({ limit: value })
      setData((d) => ({ ...d, ...updated, limit: value }))
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch { /* noop */ }
    setSaving(false)
  }

  if (phase === 'loading') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  if (phase === 'error')   return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('messaging.loadError')}</p>

  return (
    <div style={{ maxWidth: 520 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('messaging.limits.subtitle')}</p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t('messaging.limits.label')}</div>
            {ceiling != null && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {t('messaging.limits.ceiling', { value: ceiling, unit })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={0} max={ceiling ?? undefined} value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              style={{ width: 110, height: 34, padding: '0 10px', fontSize: 14, fontWeight: 600, textAlign: 'right', border: `1px solid ${overCeiling ? 'var(--color-danger)' : 'var(--border)'}`, borderRadius: 8, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 60 }}>{unit}</span>
          </div>
        </div>
        {overCeiling && (
          <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 10 }}>
            {t('messaging.limits.overCeiling', { value: ceiling, unit })}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={save} disabled={!dirty || saving || overCeiling}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, cursor: dirty && !saving && !overCeiling ? 'pointer' : 'default', opacity: (dirty && !overCeiling) || saved ? 1 : 0.55, background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>
    </div>
  )
}
