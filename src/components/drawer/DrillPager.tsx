/**
 * DrillPager — prev/next stepper for a drawer drill-down (Danny 02-08: "moeten er
 * pijltjes komen zodat je vanuit één contactpersoon naar de volgende kan en terug" —
 * we need arrows so you can step from one contact to the next and back).
 * ONE shared component for every entity's detail title row — contacts and locations
 * today, departments next (see that panel's own adoption note) — so browsing the
 * list the caller already filtered/sorted never needs a trip back to the list.
 *
 * The caller does ALL the work: it holds the rows for its OWN current scope (e.g. a
 * single location's contacts, not the whole customer) and hands down the open
 * record's 1-based `index` + `total`, plus `onPrev`/`onNext` — undefined at either
 * end, which is what disables the matching button. This component never fetches,
 * filters or sorts; it only renders what it is told, so the pager always reflects
 * EXACTLY the rows the user was looking at, never a fresh unscoped query.
 *
 * Chevron choice: up/down, not left/right (PaginationBar's page-turning metaphor for
 * a table's PAGES). These records are literally rows stacked vertically in the list
 * behind this detail, so "next" reads as "the row below" and "prev" as "the row
 * above" — matching that layout instead of borrowing the horizontal metaphor.
 */
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'

export interface DrillPagerProps {
  /** 1-based position of the open record within the caller's own filtered rows. */
  index: number
  total: number
  /** Undefined at the first/last record — the matching button renders disabled, never wraps. */
  onPrev?: () => void
  onNext?: () => void
}

// Purely rendered up/down stepper (see the module doc above): buttons disable themselves whenever the caller has no onPrev/onNext, never wrapping around.
export default function DrillPager({ index, total, onPrev, onNext }: DrillPagerProps) {
  const { t } = useTranslation('common')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {/* Arrows only — Danny 03-08 ("drillPager.position — weg die txt") killed the
          visible "x van y" counter; the position lives on as the buttons' hover title
          so the info stays reachable without the visual noise. NOT visually a no-op:
          Button variant="secondary" size="sm" paints bg var(--surface) vs the old
          var(--bg), ink var(--text) vs var(--text-muted), radius 6 vs 7, and its
          disabled recipe fills solid var(--border) with no border instead of the old
          bordered pale-chevron box. This renders inside the FROZEN candidate/customer
          drilldowns (ContactDetail.tsx, SubEntityTitleActions.tsx,
          candidates/drawer/ApplicationRow.tsx) — flagged to Danny for those screens. */}
      <Button variant="secondary" iconOnly size="sm" onClick={onPrev} disabled={!onPrev}
        title={t('drillPager.prevAt', { index, total })} aria-label={t('drillPager.prev')}>
        <ChevronUp size={14} />
      </Button>
      <Button variant="secondary" iconOnly size="sm" onClick={onNext} disabled={!onNext}
        title={t('drillPager.nextAt', { index, total })} aria-label={t('drillPager.next')}>
        <ChevronDown size={14} />
      </Button>
    </div>
  )
}
