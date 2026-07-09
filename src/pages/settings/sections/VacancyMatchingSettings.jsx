import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import Slider from '@/components/ui/Slider'

/**
 * VacancyMatchingSettings — the GLOBAL matching strictness (how critical the AI
 * matcher is overall) plus the placement APPROVAL mode (per-tenant: off = every
 * placement is always OK). The per-vacancy dimension importance (qualifications,
 * location, …) lives on each vacancy itself, not here. Persists to /settings/matching.
 */
// The backend strictness is an enum; the slider is a 3-step index onto it.
const LEVELS = ['lenient', 'balanced', 'strict']
// Approval-mode enum (backend slugs are Dutch by contract; i18n keys stay English).
const MODES = [
  { value: 'uit', key: 'off' },
  { value: 'bij_afwijking', key: 'deviation' },
  { value: 'altijd', key: 'always' },
]

export default function VacancyMatchingSettings() {
  const { t } = useTranslation('settings')
  const [level, setLevel] = useState(1) // index into LEVELS (1 = balanced default)
  const [approval, setApproval] = useState('bij_afwijking') // backend default
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  // Purchase→sale conversion factor (e.g. 1.35) — the rate-proposal fallback when no
  // price agreement covers a function/CAO/schaal/trede combo. Nullable: '' = null.
  const [conversionFactor, setConversionFactor] = useState('')
  const [savedFactor, setSavedFactor] = useState('') // last server-confirmed value, for revert-on-failure

  // Load the saved strictness enum → slider index + approval mode + conversion factor.
  useEffect(() => {
    api.get('/settings/matching')
      .then(r => {
        const d = (r.data?.data ?? r.data) ?? {}
        const i = LEVELS.indexOf(d.strictness); if (i >= 0) setLevel(i)
        if (MODES.some(m => m.value === d.approval_mode)) setApproval(d.approval_mode)
        const cf = d.conversion_factor != null ? String(d.conversion_factor) : ''
        setConversionFactor(cf); setSavedFactor(cf)
      })
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try { await api.put('/settings/matching', { strictness: LEVELS[level] }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch { /* noop */ } finally { setSaving(false) }
  }

  // Approval mode saves on click (partial PUT) — optimistic, revert + toast on failure.
  const setApprovalMode = async (mode) => {
    const prev = approval
    if (mode === prev) return
    setApproval(mode)
    try { await api.put('/settings/matching', { approval_mode: mode }) }
    catch { setApproval(prev); notifyError(t('matching.approval.saveFailed')) }
  }

  // Conversion factor saves on blur (partial PUT) — optimistic, revert + toast on
  // failure. An empty input persists null (no factor configured); a non-numeric or
  // non-positive value is rejected locally and reverted, no request sent.
  const saveConversionFactor = async () => {
    const trimmed = conversionFactor.trim()
    if (trimmed === savedFactor) return
    const num = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!isFinite(num) || num <= 0)) { setConversionFactor(savedFactor); return }
    try { await api.put('/settings/matching', { conversion_factor: num }); setSavedFactor(trimmed) }
    catch { setConversionFactor(savedFactor); notifyError(t('matching.conversionFactor.saveFailed')) }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 16, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('matching.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matching.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500,
            borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('matching.saved')}</> : <><Save size={13} /> {t('matching.save')}</>}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Slider value={level} max={2} step={1} onChange={setLevel}
          labels={[t('matching.lenient'), t('matching.balanced'), t('matching.strict')]} ariaLabel={t('matching.title')} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 22 }}>{t('matching.perVacancyHint')}</p>

      {/* Placement approval — three-option radio; native inputs keep keyboard support. */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('matching.approval.title')}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matching.approval.subtitle')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {MODES.map(({ value, key }) => {
            const active = approval === value
            return (
              <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                background: active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--bg)' }}>
                <input type="radio" name="approval_mode" value={value} checked={active}
                  onChange={() => setApprovalMode(value)} style={{ marginTop: 2, accentColor: 'var(--color-primary)' }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>
                    {t(`matching.approval.${key}`)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    {t(`matching.approval.${key}Desc`)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Purchase→sale conversion factor — the rate-proposal fallback (source:
          conversion_factor) when a placement's function/CAO/schaal/trede has no
          matching price agreement on the customer. Nullable — empty clears it. */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('matching.conversionFactor.title')}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matching.conversionFactor.subtitle')}</p>
        <input type="number" step="0.01" min="0" value={conversionFactor}
          onChange={e => setConversionFactor(e.target.value)}
          onBlur={saveConversionFactor}
          placeholder={t('matching.conversionFactor.placeholder')}
          aria-label={t('matching.conversionFactor.title')}
          style={{ marginTop: 10, width: 140, height: 34, padding: '0 10px', fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace', border: '1px solid var(--border)', borderRadius: 8,
            outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }} />
      </div>
    </div>
  )
}
