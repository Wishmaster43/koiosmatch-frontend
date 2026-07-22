import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'

/**
 * MatchRatesSettings — Settings → Matches → the purchase→sale conversion factor.
 * Danny 22-07: this is a MATCH concept (the rate-proposal fallback: purchase rate ×
 * this factor when no price agreement fits a placement's function/CAO/schaal/trede),
 * so it lives here as its own block, not under Vacancies → Matching where it used to
 * render (VacancyMatchingSettings). Only the SCREEN moved — it still persists to the
 * same tenant-wide /settings/matching resource the vacancy strictness slider uses.
 */
export default function MatchRatesSettings() {
  const { t } = useTranslation('settings')
  // Nullable: '' = no factor configured (falls back to purchase-only, source: none).
  const [conversionFactor, setConversionFactor] = useState('')
  const [savedFactor, setSavedFactor] = useState('') // last server-confirmed value, for revert-on-failure

  // Load the saved conversion factor (a slice of the same /settings/matching row).
  useEffect(() => {
    api.get('/settings/matching')
      .then(r => {
        const d = (unwrap(r)) ?? {}
        const cf = d.conversion_factor != null ? String(d.conversion_factor) : ''
        setConversionFactor(cf); setSavedFactor(cf)
      })
      .catch(() => {})
  }, [])

  // Saves on blur (partial PUT) — optimistic, revert + toast on failure. An empty
  // input persists null (no factor configured); a non-numeric or non-positive value
  // is rejected locally and reverted, no request sent.
  const saveConversionFactor = async () => {
    const trimmed = conversionFactor.trim()
    if (trimmed === savedFactor) return
    const num = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!isFinite(num) || num <= 0)) { setConversionFactor(savedFactor); return }
    try { await api.put('/settings/matching', { conversion_factor: num }); setSavedFactor(trimmed) }
    catch { setConversionFactor(savedFactor); notifyError(t('matchRates.saveFailed')) }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('matchRates.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matchRates.subtitle')}</p>
      <input type="number" step="0.01" min="0" value={conversionFactor}
        onChange={e => setConversionFactor(e.target.value)}
        onBlur={saveConversionFactor}
        placeholder={t('matchRates.placeholder')}
        aria-label={t('matchRates.title')}
        style={{ marginTop: 14, width: 140, height: 34, padding: '0 10px', fontSize: 13,
          fontFamily: 'JetBrains Mono, monospace', border: '1px solid var(--border)', borderRadius: 8,
          outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }} />
    </div>
  )
}
