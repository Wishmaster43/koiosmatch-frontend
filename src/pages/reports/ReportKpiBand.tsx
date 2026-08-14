/**
 * ReportKpiBand — the ONE nine-card KPI strip every report page opens with
 * (Danny 14-08: "achtergrond is niet wit en bij rapporten wel", measured live on
 * #reports.matches).
 *
 * Why this component exists: all 17 reports plus the reports dashboard each
 * wrapped their `InsightsRow` in a `background: var(--surface)` card, so the nine
 * white KPI cards sat inside one big white box and the strip read as a single
 * white slab. The real dashboard (pages/dashboard) does the opposite — its cards
 * sit directly on the page background, so the tinted `--bg` shows between them and
 * each card reads as a card. This band reproduces THAT footprint: no surface, no
 * border, no radius of its own — just the cards on the page background.
 *
 * It is a component and not a style constant on purpose: the strip is the one
 * element repeated across 18 files, and a shared constant would still let each
 * file re-add its own wrapper (which is exactly how the white box spread). One
 * component means one look, forever (§0.9, §11).
 */
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec, DonutSpec } from '@/components/insights/InsightsRow'

export default function ReportKpiBand({ kpis, donuts, clearTitle, notice }: {
  kpis?: KpiSpec[]
  donuts?: DonutSpec[]
  clearTitle?: string
  notice?: string
}) {
  // Dev-time guard for the nine-card promise (Danny, twice): every report's
  // strip must be exactly nine cards in every data state — a card whose value
  // is unknown renders the house dash, it never disappears or multiplies. This
  // is the ONE shared place that can catch a regression; the actual "always
  // nine, honest dash" content still lives per-report (§0 no fake affordances
  // — this component can't invent a report's own dash-worthy fields).
  if (import.meta.env.DEV) {
    const count = (kpis?.length ?? 0) + (donuts?.length ?? 0)
    if (count !== 9) {
      // eslint-disable-next-line no-console
      console.error(`ReportKpiBand: expected exactly 9 cards, got ${count}. The KPI strip must never reflow between report pages.`)
    }
  }
  return (
    <div style={{ marginBottom: 16 }}>
      {/* `wrapLabels`: nine cards on one row leave ~110px per label, so the shared
          single-line ellipsis turned real labels into "TOTAAL MA…" / "BEËINDIGIN…".
          The dashboard wraps its card titles to two lines instead — same here, so
          the reader can always tell WHAT the number counts. */}
      <InsightsRow kpis={kpis} donuts={donuts} padding="0 0 0 0" wrapLabels
        clearTitle={clearTitle} notice={notice} />
    </div>
  )
}
