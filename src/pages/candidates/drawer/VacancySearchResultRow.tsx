// Extracted from VacancySearchTab (SIZE-SPLIT-B, zero behaviour change): one
// row in the result list (Danny 23-07: row click selects the summary card,
// the title link/icon navigates instead).
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import ScorePill from '@/components/match/ScorePill'
import SearchResultRowFrame from '@/components/drawer/SearchResultRowFrame'
import { Mono, Caption, SectionTitle } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import { formatRange } from './vacancySearchFormat'
import type { VacancySearchRow } from '../hooks/useVacancySearch'
import type { Id } from '@/types/common'

export default function VacancySearchResultRow({ row, isSelected, onSelect }: {
  row: VacancySearchRow; isSelected: boolean; onSelect: (id: Id) => void
}) {
  const { t } = useTranslation('candidates')
  const { formatDistanceKm } = useNumberFormat()
  return (
    // Row = div[role=button] (not <button>: the title nests EntityLink's own
    // button+anchor, and interactive-inside-interactive is invalid HTML).
    // Danny 23-07: row click = summary card HERE; the title link/icon (Match-tab
    // style: primary name in-app, trailing icon new tab) navigates instead.
    <SearchResultRowFrame isSelected={isSelected} onSelect={() => onSelect(row.id)}>
      <div style={{ minWidth: 0 }}>
        {/* Title clicks must not ALSO flip the summary selection; the AI mark
            signals a Koios-advised match (MATCH-EXPLORER-1 fase 2+3). */}
        {/* SectionTitle carries the text identity only — the click/keydown stop-
            propagation sits on this plain wrapping div (the atom's props don't
            carry event handlers). */}
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <SectionTitle as="div" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            {row.aiAdvised && <KoiosAiMark size={16} title={row.aiAdviceReason ?? t('vacancySearch.aiAdvised')} />}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              <EntityLink page="vacancies" id={row.id} title={t('vacancySearch.openInApp')}>{row.title}</EntityLink>
            </span>
          </SectionTitle>
        </div>
        {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
        <Caption as="div" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {[row.customer, row.city].filter(Boolean).join(' · ') || '—'}
        </Caption>
        {/* V-search-1: per-row meta chips — hours + employment type, only when
            the row really carries them (salary is detail-only, stays on the
            summary card). Mono for the numbers (§4). */}
        {(formatRange(row.hoursMin, row.hoursMax, n => String(n)) || row.employmentType) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
            {/* HUISSTIJL-1: identical fontFamily/size/colour + chip-frame render. */}
            {formatRange(row.hoursMin, row.hoursMax, n => String(n)) && (
              <Mono style={{ fontSize: 10.5, color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                {t('vacancySearch.cardHours', { range: formatRange(row.hoursMin, row.hoursMax, n => String(n)) })}
              </Mono>
            )}
            {row.employmentType && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', border: '1px solid var(--border)',
                borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.employmentType}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {row.score != null && <ScorePill score={row.score} />}
        {/* HUISSTIJL-1: Caption owns the 11/muted identity; Mono only adds the font-family. */}
        {row.distanceKm != null && (
          <Caption><Mono>{formatDistanceKm(row.distanceKm)} km</Mono></Caption>
        )}
        {/* Expand affordance (Danny 05-08, point 2: "niet duidelijk dat je een
            vacature kan openklappen") — a visible chevron on EVERY row, on top
            of the row's own cursor:pointer + hover background. Decorative only
            (the row itself already carries the click/keyboard semantics above).
            Bold + primary-orange (Danny 06-08 screenshot feedback) — same token
            EntityLink's title button uses, so it reads as one affordance family. */}
        <ChevronRight size={14} strokeWidth={3} aria-hidden="true" style={{ color: 'var(--color-primary-text)' }} />
      </div>
    </SearchResultRowFrame>
  )
}
