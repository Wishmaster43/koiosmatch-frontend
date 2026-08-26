/**
 * VacancyMatchingSettings — the GLOBAL matching strictness (how critical the AI
 * matcher is overall) plus the match APPROVAL mode (per-tenant: off = every
 * match is always OK). The per-vacancy dimension importance (qualifications,
 * location, …) lives on each vacancy itself, not here. Persists to /settings/matching.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import Slider from '@/components/ui/Slider'
import SegmentedControl from '@/components/ui/SegmentedControl'
import SaveButton from '@/components/ui/SaveButton'
import { PageTitle, SectionTitle, Mono } from '@/components/ui/typography'

// The backend strictness is an enum; the slider is a 3-step index onto it.
const LEVELS = ['lenient', 'balanced', 'strict']
// Approval-mode enum (backend slugs are Dutch by contract; i18n keys stay English).
const MODES = [
  { value: 'uit', key: 'off' },
  { value: 'bij_afwijking', key: 'deviation' },
  { value: 'altijd', key: 'always' },
]

// Settings screen for the global matching strictness slider and the match-approval
// mode; per-vacancy dimension weights live elsewhere (see the module doc comment above).
export default function VacancyMatchingSettings() {
  const { t } = useTranslation('settings')
  const [level, setLevel] = useState(1) // index into LEVELS (1 = balanced default)
  const [approval, setApproval] = useState('bij_afwijking') // backend default
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)
  // A failed GET must never let the hardcoded defaults above (level=1, approval=
  // 'bij_afwijking') pass as the tenant's real saved values — a persistent banner
  // + disabled controls stop the compounding wrong-write the audit named.
  const [loadError, setLoadError] = useState(false)

  // Load the saved strictness enum → slider index + approval mode. The purchase→sale
  // conversion factor moved to Settings → Matches → MatchRatesSettings (Danny 22-07:
  // it's a match concept, not a vacancy one) — this screen no longer reads/writes it.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    api.get('/settings/matching')
      .then(r => {
        if (!alive) return
        const d = (unwrap(r)) ?? {}
        const i = LEVELS.indexOf(d.strictness); if (i >= 0) setLevel(i)
        if (MODES.some(m => m.value === d.approval_mode)) setApproval(d.approval_mode)
      })
      .catch(() => { if (alive) { setLoadError(true); notifyError(t('statusList.loadError')) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` from useTranslation is stable in the app; excluding it avoids a re-fetch loop
  }, [])

  // Persist the strictness level (slider index mapped back to its enum slug), flashing the saved-check briefly on success.
  const save = async () => {
    if (loadError) return
    setSaving(true)
    try { await api.put('/settings/matching', { strictness: LEVELS[level] }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  // Approval mode saves on click (partial PUT) — optimistic, revert + toast on failure.
  const setApprovalMode = async (mode) => {
    if (loadError) return
    const prev = approval
    if (mode === prev) return
    setApproval(mode)
    try { await api.put('/settings/matching', { approval_mode: mode }) }
    catch { setApproval(prev); notifyError(t('matching.approval.saveFailed')) }
  }

  // Danny 22-07: concrete number + % alongside the word label — position on the
  // 3-step scale (0/50/100%), since this is a single global enum, not a weighted
  // sum across siblings like the per-vacancy dimension weights (MatchingTab).
  const levelPct = Math.round((level / (LEVELS.length - 1)) * 100)

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 16, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <PageTitle>{t('matching.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matching.subtitle')}</p>
        </div>
        {/* SaveButton — the ONE saved-state save action (§4 success token pair). Disabled
            while the load failed so a guessed default can never overwrite the real setting. */}
        <SaveButton saved={saved} onClick={save} disabled={saving || loadError}>
          {saved ? <><Check size={13} /> {t('matching.saved')}</> : <><Save size={13} /> {t('matching.save')}</>}
        </SaveButton>
      </div>

      {/* Honest load states — a failed GET must never silently show the hardcoded
          defaults as if they were the tenant's saved values. */}
      {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading')}</p>}
      {loadError && <p style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('statusList.loadError')}</p>}

      <div style={{ marginTop: 18, opacity: loading || loadError ? 0.5 : 1, pointerEvents: loading || loadError ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Mono style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {level + 1}/{LEVELS.length} · {levelPct}%
          </Mono>
        </div>
        <Slider value={level} max={2} step={1} onChange={setLevel}
          labels={[t('matching.lenient'), t('matching.balanced'), t('matching.strict')]} ariaLabel={t('matching.title')} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 22 }}>{t('matching.perVacancyHint')}</p>

      {/* Match approval — three-option segmented control (house idiom for option cards). */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', opacity: loading || loadError ? 0.5 : 1, pointerEvents: loading || loadError ? 'none' : 'auto' }}>
        <SectionTitle>{t('matching.approval.title')}</SectionTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 12 }}>{t('matching.approval.subtitle')}</p>
        <SegmentedControl
          ariaLabel={t('matching.approval.title')}
          value={approval}
          onChange={setApprovalMode}
          options={MODES.map(({ value, key }) => ({
            value,
            label: t(`matching.approval.${key}`),
            description: t(`matching.approval.${key}Desc`),
          }))}
        />
      </div>
    </div>
  )
}
