import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useLookups } from '@/context/LookupsContext'
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
import type { ApplicationDetail } from '@/types/application'

interface CompetitionBlockProps {
  application: ApplicationDetail
}

/**
 * CompetitionBlock — "hoeveel anderen hebben gesolliciteerd en waar staan ze"
 * (Danny 25-07 d). Reuses the shared useApplicationVacancy fetch (the same cache
 * entry VacancyTab reads) and derives the funnel breakdown already computed by
 * mapVacancyDetail — no new endpoint.
 *
 * PRIVACY (§8): shows COUNTS ONLY, never the other candidates' names or any of
 * their data — a recruiter who needs the actual list opens the vacancy itself,
 * which already carries the full applicant list with proper access checks.
 */
export default function CompetitionBlock({ application: a }: CompetitionBlockProps) {
  const { t } = useTranslation('applications')
  const { funnelTypes } = useLookups()
  const { vacancy, loading, error } = useApplicationVacancy(a.vacancyId)

  // No vacancy linked — nothing to compare against.
  if (a.vacancyId == null) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('competition.noVacancy')}</p>
  }
  if (loading) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('competition.loading')}</p>
  }
  if (error || !vacancy) {
    return <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('competition.error')}</p>
  }

  // Funnel chips in the tenant's configured order, counts-only (no candidate data).
  const byPhase = vacancy.applicationsByPhase ?? {}
  const chips = funnelTypes
    .map(f => ({ ...f, count: Number(byPhase[f.value]) || 0 }))
    .filter(f => f.count > 0)

  const total = vacancy.applicationsCount ?? 0
  const thisPhaseCount = Number(byPhase[a.phaseKey]) || 0
  const othersInSamePhase = Math.max(0, thisPhaseCount - 1)
  const phaseMeta = funnelTypes.find(f => f.value === a.phaseKey)
  const phaseLabel = a.phaseLabel || phaseMeta?.label || a.phaseKey

  return (
    <SectionCard title={t('competition.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--text)' }}>{t('competition.total', { count: total })}</div>

        {total > 1 && chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chips.map(chip => (
              <SoftChip key={chip.value} color={chip.color} label={`${chip.label} ${chip.count}`} />
            ))}
          </div>
        )}

        {total === 1 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('competition.onlyOne')}</div>
        ) : othersInSamePhase > 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('competition.inPhase', { phase: phaseLabel, count: othersInSamePhase })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('competition.aloneInPhase', { phase: phaseLabel })}</div>
        )}
      </div>
    </SectionCard>
  )
}
