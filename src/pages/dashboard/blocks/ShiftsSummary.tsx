/**
 * ShiftsSummary — a planning dashboard block: open / filled / unfilled shifts
 * ("diensten") + the occupancy bar, so a planner sees coverage at a glance.
 * Values come from the backend dashboard feed (🟡 render "—" until it lands).
 * Click → the planning screen.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { useNumberFormat } from '@/lib/formatters'
import StatTile from '@/components/ui/StatTile'
import { SectionTitle, Caption } from '@/components/ui/typography'

// The shared StatTile atom (klus c) — value-first with the bucket's colour dot.
function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return <StatTile label={label} value={value} dotColor={color} />
}

export default function ShiftsSummary({ open, filled, unfilled, occupancy, onOpen }: {
  open?: number | null
  filled?: number | null
  unfilled?: number | null
  occupancy?: number | null
  onOpen?: () => void
}) {
  const { t } = useTranslation('dashboard')
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  const n = (v?: number | null) => (v == null ? '—' : formatNumber(v))
  const pct = occupancy != null ? Math.max(0, Math.min(100, Math.round(occupancy))) : null
  return (
    <div {...interactive(onOpen)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, cursor: onOpen ? 'pointer' : 'default' }}>
      <SectionTitle as="div" style={{ marginBottom: 12 }}>{t('block.shifts')}</SectionTitle>
      <div style={{ display: 'flex', gap: 12, marginBottom: pct != null ? 14 : 0 }}>
        <Tile label={t('block.shiftsOpen')}     value={n(open)}     color="var(--color-warning)" />
        <Tile label={t('block.shiftsFilled')}   value={n(filled)}   color="var(--color-success)" />
        <Tile label={t('block.shiftsUnfilled')} value={n(unfilled)} color="var(--color-danger)" />
      </div>
      {pct != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <Caption>{t('block.shiftsOccupancy')}</Caption><Caption>{pct}%</Caption>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--button-fill)', borderRadius: 4 }} />
          </div>
        </div>
      )}
    </div>
  )
}
