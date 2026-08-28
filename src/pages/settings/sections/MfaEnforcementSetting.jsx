/**
 * MfaEnforcementSetting — admin-only organisation policy toggle "Require MFA for
 * everyone". Persists the tenant setting `mfa.enforced` ('1'/'0') via the shared
 * POST /settings mechanism; the SERVER enforces the policy (non-enrolled users get
 * 403 mfa_enrollment_required on everything except the enrollment surface).
 */
import { useEffect, useState } from 'react'
import { tintBorder } from '@/lib/tint'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import Spinner from '@/components/ui/Spinner'
import { SettingRow, Toggle } from '../components/SettingsKit'
import { loadSettings, saveSettings } from '../lib/settingsApi'

const KEY = 'mfa.enforced'

// Admin-only "Require MFA for everyone" toggle, optimistic save with revert on failure.
export default function MfaEnforcementSetting() {
  const { t } = useTranslation('settings')
  const { isAdmin } = useAuth() ?? {}
  const [enforced, setEnforced] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  // Distinguishes "loaded and off" from "load failed" so we never render a false off-toggle (§9).
  const [loadError, setLoadError] = useState(false)

  // Load the current tenant flag once ('1' = enforced; tolerate 'true' just in case).
  useEffect(() => {
    let alive = true
    loadSettings()
      .then(s => { if (alive) setEnforced(['1', 'true'].includes(String(s?.[KEY]))) })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Optimistic save on toggle; revert and surface an error when the POST fails.
  const toggle = async (next) => {
    if (loading || saving) return // ignore clicks until the current value is known/persisted
    setEnforced(next); setSaving(true); setError('')
    try { await saveSettings({ [KEY]: next ? '1' : '0' }) }
    catch { setEnforced(!next); setError(t('security.enforceError')) }
    finally { setSaving(false) }
  }

  // Tenant policy — admin surface only (the backend re-checks authorization).
  if (!isAdmin?.()) return null

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        {t('security.enforceSection')}
      </h3>
      <SettingRow label={t('security.enforceTitle')} description={t('security.enforceDesc')}>
        {loading || saving
          ? <span style={{ color: 'var(--text-muted)' }}><Spinner size={15} /></span>
          : null}
        {/* Load failed: the real value is unknown, so show a disabled toggle instead
            of a false "off" the admin could mistake for the actual policy state. */}
        {loadError
          ? <Toggle checked={false} onChange={() => {}} disabled />
          : <Toggle checked={enforced} onChange={toggle} />}
      </SettingRow>
      {/* One error surface for both failure kinds (load vs save) — §4 tint via lib/tint. */}
      {(loadError || error) && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
                       border: `1px solid ${tintBorder('var(--color-danger)', true)}`, borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
          {loadError ? t('security.enforceLoadError') : error}
        </div>
      )}
    </div>
  )
}
