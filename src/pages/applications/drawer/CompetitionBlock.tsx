/**
 * CompetitionBlock — "hoeveel anderen hebben gesolliciteerd en waar staan ze"
 * ("how many others have applied and where do they stand") (Danny 25-07 d).
 * Reuses the shared useApplicationVacancy fetch (the same cache
 * entry VacancyTab reads) and derives the funnel breakdown already computed by
 * mapVacancyDetail — no new endpoint.
 *
 * SOLLICITANTEN-2 (Danny 21-08 ruling 3, "Andere sollicitanten ik zie geen
 * lijst??" — "Other applicants, I don't see a list??"): the summary line now
 * expands into a compact row per OTHER
 * applicant on the same vacancy (name + phase StatusPill), collapsed by
 * default. MEASURED data source: `vacancy.applications` — the SAME
 * GET /vacancies/{id} response the vacancy drawer's own ApplicantsTab reads
 * (mapVacancyDetail's `applications` array, shared via the useApplicationVacancy
 * React Query cache this block already used for its counts) — so expanding
 * fires NO second request; it only reveals rows already in memory, filtered to
 * exclude this application. Clicking a row opens that application the same way
 * every other cross-record click in the app does (useNavigation().openEntity).
 *
 * PRIVACY (§8): the collapsed summary still shows COUNTS ONLY; the expanded
 * list shows the SAME data the vacancy's own Applicants tab already exposes to
 * this recruiter (name + phase), never anything the vacancy tab itself would
 * withhold.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import EntityLink from '@/components/ui/EntityLink'
import { useLookups } from '@/context/LookupsContext'
import { useNavigation } from '@/context/NavigationContext'
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
import type { ApplicationDetail } from '@/types/application'

interface CompetitionBlockProps {
  application: ApplicationDetail
}

export default function CompetitionBlock({ application: a }: CompetitionBlockProps) {
  const { t } = useTranslation('applications')
  const { funnelTypes } = useLookups()
  const { vacancy, loading, error } = useApplicationVacancy(a.vacancyId)
  const { openEntity } = useNavigation()
  // Collapsed by default — an expandable list, not a permanent wall of rows.
  const [expanded, setExpanded] = useState(false)

  // No vacancy linked — nothing to compare against.
  if (a.vacancyId == null) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('competition.noVacancy')}</p>
  }
  if (loading) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('competition.loading')}</p>
  }
  if (error || !vacancy) {
    return <p style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('competition.error')}</p>
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

  // SOLLICITANTEN-2: every OTHER application on this vacancy, already embedded
  // on the vacancy detail — filter out this application's own row.
  const others = (vacancy.applications ?? []).filter(app => String(app.id ?? '') !== String(a.id ?? ''))

  return (
    <SectionCard title={t('competition.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* S7: the count text becomes a real link to the vacancy record — PRIVACY
            (§8) still holds, this only opens the vacancy itself (which already
            carries its own applicant list + access checks), never the other
            applicants' data inline here. Lands on the vacancy's default tab, not
            its Sollicitaties ("Applications") sub-tab directly — targeting a specific sub-tab
            needs the cross-entity `{ open, tab }` intent extended on the
            VACANCIES page (out of this cluster's territory, see CLAUDE.md §3A). */}
        {/* Canon (05-08): body text 12px, matching the muted lines below in this card. */}
        <div style={{ fontSize: 12, color: 'var(--text)' }}>
          <EntityLink page="vacancies" id={a.vacancyId} title={t('drawer.openVacancy')}>
            {t('competition.total', { count: total })}
          </EntityLink>
        </div>

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

        {/* SOLLICITANTEN-2: the expandable list itself — hidden entirely when
            there is nothing to show (mirrors the "onlyOne" gate above). */}
        {others.length > 0 && (
          <div>
            {/* Verify round (21-08): the ghost Button IS the house fit for an
                inline disclosure toggle — the hand-rolled text-link went. */}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)} style={{ padding: '2px 4px' }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {expanded ? t('competition.hideList') : t('competition.showList')}
            </Button>
            {expanded && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                {others.map(app => (
                  <button key={app.id} type="button"
                    onClick={() => app.id != null && openEntity('applications', app.id)}
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- structural list ROW acting as a navigation target, not a chrome action (mirrors MatchCard/ApplicationRow's own row treatment)
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, width: '100%',
                      border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                    <Avatar initials={app.candidateInitials} size={22} soft />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.candidateName || '—'}
                    </span>
                    <StatusPill label={app.phaseLabel} color={app.phaseColor} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
