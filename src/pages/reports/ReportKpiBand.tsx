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
