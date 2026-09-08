// Extracted from VacancySearchTab (SIZE-SPLIT-B, zero behaviour change): the
// compact summary card for the SELECTED vacancy (Danny 23-07, point 5).
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import DrillPager from '@/components/drawer/DrillPager'
import EntityLink from '@/components/ui/EntityLink'
import Button from '@/components/ui/Button'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import StatusPill from '@/components/ui/StatusPill'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import DrawerAddButton from './DrawerAddButton'
import { useNumberFormat, formatDistanceKm } from '@/lib/formatters'
import { Mono, Caption, SectionTitle } from '@/components/ui/typography'
import { formatRange } from './vacancySearchFormat'
import type { VacancySearchRow } from '../hooks/useVacancySearch'
import type { VacancyLookupItem } from '@/context/VacancyLookupsContext'

// A tenant-lookup value carried on the FROZEN vacancyShape detail (education/
// seniority) — either the resolved {value,label,color} object or absent.
export interface LookupChip { value?: string; label?: string; color?: string | null }

// P8-result-cards: the extra detail fields the lazy GET /vacancies/{id} fetch
// also reads (FROZEN vacancyShape, CMBE wave 3) — salary/experience/hours are
// tolerant numeric coercions (Laravel decimal-as-string, §10), education/
// seniority arrive as {value,label,color}|null straight from the resource.
export interface VacancyDetail {
  description?: string
  salaryMin: number | null
  salaryMax: number | null
  salaryPeriod: string | null
  experienceMin: number | null
  experienceMax: number | null
  education: LookupChip | null
  seniority: LookupChip | null
}

export default function VacancySearchSummaryCard({
  selectedRow, selectedIndex, total, goPrev, goNext, onClose, onApply, description, detail, statusMeta,
}: {
  selectedRow: VacancySearchRow; selectedIndex: number; total: number
  goPrev: (() => void) | undefined; goNext: (() => void) | undefined
  onClose: () => void; onApply: () => void
  description: string | null; detail: VacancyDetail | null
  statusMeta: (status?: string | null) => VacancyLookupItem
}) {
  const { t } = useTranslation('candidates')
  // Tenant currency + app locale for the salary range (I18N-1 L5).
  const { formatCurrency } = useNumberFormat()
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          {/* The title IS the link (Danny 23-07): Match-style EntityLink — orange
              name opens in-app, trailing icon a new tab. No separate action row. */}
          <SectionTitle as="div">
            <EntityLink page="vacancies" id={selectedRow.id}>{selectedRow.title}</EntityLink>
          </SectionTitle>
          {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
          <Caption as="div">{[selectedRow.customer, selectedRow.city].filter(Boolean).join(' · ') || '—'}</Caption>
        </div>
        {/* Right column (Danny 13-08 screenshot): pager+close on top, Solliciteren
            BENEATH them — the title row keeps its full width so long vacancy names
            no longer truncate against the primary action. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Browse through the current result list (Danny 05-08, point 3) — same
                corner as every other detail pager (ContactDetail/LocationDetail). */}
            <DrillPager index={selectedIndex + 1} total={total} onPrev={goPrev} onNext={goNext} />
            <Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label={t('common:close')}>
              <X size={14} />
            </Button>
          </div>
          {/* Solliciteren (Danny 06-08): the primary action for this open score panel —
              opens the shared AddApplicationModal with this vacancy prefilled. */}
          <DrawerAddButton onClick={onApply} label={t('vacancySearch.apply')} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* HUISSTIJL-1: Caption owns the 11/muted identity; Mono only adds the font-family. */}
        {selectedRow.distanceKm != null && (
          <Caption><Mono>{formatDistanceKm(selectedRow.distanceKm)} km</Mono></Caption>
        )}
        <StatusPill label={statusMeta(selectedRow.status).label} color={statusMeta(selectedRow.status).color} />
        {/* Already-fetched search-row fields (hours + contract form) — render on
            the card too, no extra request needed. */}
        {selectedRow.employmentType && <StatusPill label={selectedRow.employmentType} color="var(--text-muted)" />}
        {/* HUISSTIJL-1: Caption owns the 11/muted identity; Mono only adds the font-family. */}
        {formatRange(selectedRow.hoursMin, selectedRow.hoursMax, n => String(n)) && (
          <Caption><Mono>
            {t('vacancySearch.cardHours', { range: formatRange(selectedRow.hoursMin, selectedRow.hoursMax, n => String(n)) })}
          </Mono></Caption>
        )}
      </div>
      {/* P8-result-cards: the lazily-fetched detail line (salary/experience) +
          education/seniority soft-chips — summary card ONLY, list rows stay calm.
          The three formatCurrency(…, undefined, 0) calls below all format the same
          salary range in the TENANT's currency and the app locale (I18N-1 L5 via
          useNumberFormat: a GB tenant sees pounds, not a locked EUR/nl-NL pair). */}
      {detail && (formatRange(detail.salaryMin, detail.salaryMax, n => formatCurrency(n, undefined, 0)) || formatRange(detail.experienceMin, detail.experienceMax, n => String(n)) || detail.education || detail.seniority) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* HUISSTIJL-1: Caption owns the 11/muted identity; Mono only adds the font-family. */}
          {formatRange(detail.salaryMin, detail.salaryMax, n => formatCurrency(n, undefined, 0)) && (
            <Caption><Mono>
              {t('vacancySearch.cardSalary', {
                range: formatRange(detail.salaryMin, detail.salaryMax, n => formatCurrency(n, undefined, 0)),
                period: detail.salaryPeriod ? t(`vacancySearch.salaryPeriod.${detail.salaryPeriod}`, { defaultValue: detail.salaryPeriod }) : '',
              })}
            </Mono></Caption>
          )}
          {formatRange(detail.experienceMin, detail.experienceMax, n => String(n)) && (
            // HUISSTIJL-1: identical 11/400/var(--text-muted) render.
            <Caption>
              {t('vacancySearch.cardExperience', { range: formatRange(detail.experienceMin, detail.experienceMax, n => String(n)) })}
            </Caption>
          )}
          {/* Seniority uses its lookup colour (§4); education mirrors the same soft-chip look. */}
          {detail.seniority?.label && <StatusPill label={detail.seniority.label} color={detail.seniority.color} />}
          {detail.education?.label && <StatusPill label={detail.education.label} color={detail.education.color} />}
        </div>
      )}
      {description && <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{description}</p>}
      {/* Read-only LIVE score (CMBE MATCH-EXPLORER-1 fase 2+3) — no onSave, so
          MatchScoreBlock renders without its edit/adjust controls. */}
      {selectedRow.score != null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <MatchScoreBlock score={selectedRow.score} criteria={selectedRow.criteria} />
        </div>
      )}
      {selectedRow.aiAdviceReason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <KoiosAiMark size={16} title={t('vacancySearch.aiAdvised')} />
          <span>{selectedRow.aiAdviceReason}</span>
        </div>
      )}
    </div>
  ) as ReactNode
}
