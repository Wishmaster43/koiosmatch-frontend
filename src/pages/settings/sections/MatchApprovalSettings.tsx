/**
 * MatchApprovalSettings — the per-tenant match APPROVAL mode (off = every match is
 * always OK). Moved here from the vacancies matching screen (DECISIONS §23
 * MATCH-APPROVAL-2, Danny 05-11). Wire: GET/PUT /settings/matching { approval_mode }.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { PageTitle, Caption } from '@/components/ui/typography'
import { SETTINGS_MAX_W_WIDE } from '@/pages/settings/components/settingsMetrics'

// Approval-mode enum: English wire values (legacy Dutch aliases still accepted server-side).
const MODES = [
  { value: 'off', key: 'off' },
  { value: 'on_deviation', key: 'deviation' },
  { value: 'always', key: 'always' },
]

// Settings screen for the match approval mode; saves on click, optimistic with revert.
export default function MatchApprovalSettings() {
  const { t } = useTranslation('settings')
  const [approval, setApproval] = useState('on_deviation') // backend default
  const [loading, setLoading] = useState(true)
  // A failed GET must never let the default pass as the tenant's saved value.
  const [loadError, setLoadError] = useState(false)

  // Load the matching object and read only approval_mode from it.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    Promise.resolve()
      .then(() => api.get('/settings/matching'))
      .then(res => {
        if (!alive) return
        const matching = unwrap(res) as { approval_mode?: string } | null
        if (!matching || typeof matching !== 'object' || Array.isArray(matching)) { setLoadError(true); return }
        if (MODES.some(m => m.value === matching.approval_mode)) setApproval(matching.approval_mode as string)
      })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Approval mode saves on click (partial PUT), optimistic, revert + toast on failure.
  const setApprovalMode = async (mode: string) => {
    if (loadError) return
    const prev = approval
    if (mode === prev) return
    setApproval(mode)
    try { await api.put('/settings/matching', { approval_mode: mode }) }
    catch { setApproval(prev); notifyError(t('matching.approval.saveFailed')) }
  }

  return (
    <div style={{ maxWidth: SETTINGS_MAX_W_WIDE }}>
      <PageTitle>{t('matching.approval.title')}</PageTitle>
      <Caption style={{ display: 'block', marginTop: 2 }}>{t('matching.approval.subtitle')}</Caption>
      {loading && <Caption style={{ display: 'block', marginTop: 12 }}>{t('common.loading')}</Caption>}
      {loadError && <p role="alert" style={{ marginTop: 12 }}><Caption style={{ color: 'var(--color-danger-text)' }}>{t('statusList.loadError')}</Caption></p>}
      {!loading && !loadError && (
        <div style={{ marginTop: 18 }}>
          {/* The chosen mode reads as chosen via the §4 "aan/gelukt" success pair. */}
          <SegmentedControl
            ariaLabel={t('matching.approval.title')}
            color="var(--color-success)"
            activeOnly
            activeFill="var(--color-success-bg)"
            value={approval}
            onChange={setApprovalMode}
            options={MODES.map(({ value, key }) => ({
              value,
              label: t(`matching.approval.${key}`),
              description: t(`matching.approval.${key}Desc`),
            }))}
          />
        </div>
      )}
    </div>
  )
}
