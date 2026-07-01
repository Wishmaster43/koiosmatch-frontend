/**
 * MessageRetention — two retention periods (in days): the tenant-wide policy and
 * the user's own. The effective retention is the LOWEST of the two (the backend
 * enforces this too). Each can be saved independently. Loading/error handled.
 *
 * Shape assumption (confirm with backend): GET → { days }.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { getTenantRetention, putTenantRetention, getProfileRetention, putProfileRetention } from './messagingApi'

// One labelled day-input row with its own save state.
function RetentionRow({ label, hint, value, onChange, onSave }) {
  const { t } = useTranslation('settings')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const save = async () => {
    setSaving(true)
    try { await onSave(); setSaved(true); setTimeout(() => setSaved(false), 1800) } catch { /* noop */ }
    setSaving(false)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 90, height: 32, padding: '0 10px', fontSize: 14, fontWeight: 600, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 48 }}>{t('messaging.retention.days')}</span>
      <button onClick={save} disabled={saving} aria-label={t('common:save')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
        {saved ? <Check size={13} /> : saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
      </button>
    </div>
  )
}

export default function MessageRetention() {
  const { t } = useTranslation('settings')
  const [tenant, setTenant]   = useState(0)
  const [own, setOwn]         = useState(0)
  const [phase, setPhase]     = useState('loading')   // loading | error | ready

  // Load both retention values together.
  useEffect(() => {
    Promise.all([getTenantRetention(), getProfileRetention()])
      .then(([tn, pr]) => { setTenant(Number(tn?.days ?? 0)); setOwn(Number(pr?.days ?? 0)); setPhase('ready') })
      .catch(() => setPhase('error'))
  }, [])

  if (phase === 'loading') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  if (phase === 'error')   return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('messaging.loadError')}</p>

  // Effective = the lowest of the two (0 = unlimited is treated as "no cap").
  const positives = [tenant, own].filter((d) => d > 0)
  const effective = positives.length ? Math.min(...positives) : 0

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('messaging.retention.subtitle')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RetentionRow label={t('messaging.retention.tenant')} hint={t('messaging.retention.tenantHint')}
          value={tenant} onChange={setTenant} onSave={() => putTenantRetention({ days: tenant })} />
        <RetentionRow label={t('messaging.retention.own')} hint={t('messaging.retention.ownHint')}
          value={own} onChange={setOwn} onSave={() => putProfileRetention({ days: own })} />
      </div>

      {/* Effective retention */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--color-primary-bg)', borderRadius: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('messaging.retention.effective')}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
          {effective > 0 ? t('messaging.retention.effectiveDays', { count: effective }) : t('messaging.retention.unlimited')}
        </span>
      </div>
    </div>
  )
}
