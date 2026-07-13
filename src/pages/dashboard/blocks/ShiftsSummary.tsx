/**
 * ShiftsSummary — a planning dashboard block: open / filled / unfilled shifts
 * ("diensten") + the occupancy bar, so a planner sees coverage at a glance.
 * Values come from the backend dashboard feed (🟡 render "—" until it lands).
 * Click → the planning screen.
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { useNumberFormat } from '@/lib/formatters'

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      </div>
    </div>
  )
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
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('block.shifts')}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: pct != null ? 14 : 0 }}>
        <Tile label={t('block.shiftsOpen')}     value={n(open)}     color="var(--color-warning)" />
        <Tile label={t('block.shiftsFilled')}   value={n(filled)}   color="var(--color-success)" />
        <Tile label={t('block.shiftsUnfilled')} value={n(unfilled)} color="var(--color-danger)" />
      </div>
      {pct != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>{t('block.shiftsOccupancy')}</span><span>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 4 }} />
          </div>
        </div>
      )}
    </div>
  )
}
