/**
 * ModuleView — renders a module's configured KPI blocks on a dashboard/report.
 *
 * The layout (which blocks, in what order) comes from the saved per-module view
 * config; the live values come from the caller via `data` (keyed by block id):
 *   data[blockId] = { value, sub?, onClick? }
 *
 * Adding/removing/reordering a block is done in Settings → Views, never here.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import KpiBlock from '../ui/KpiBlock'
import { useModuleView } from '@/lib/settings/useModuleView'

interface BlockData { value?: ReactNode; sub?: ReactNode; onClick?: () => void }

// Renders one module's configured KPI blocks (see the module doc above): layout comes from the saved view config, live values come from the caller's `data` map.
export default function ModuleView({ module, data = {}, loading = false }: {
  module: string; data?: Record<string, BlockData>; loading?: boolean
}) {
  // Block names come from the registry as i18n keys (§5) — translate on render.
  const { t } = useTranslation('settings')
  const blocks = useModuleView(module)
  const kpis = blocks.filter(b => b.type === 'kpi')
  if (kpis.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 12 }}>
      {kpis.map(b => {
        const d: BlockData = data[b.id] ?? {}
        return (
          <KpiBlock
            key={b.id}
            label={t(b.labelKey)}
            icon={b.icon}
            color={b.color}
            bg={b.bg}
            value={d.value}
            sub={d.sub}
            loading={loading}
            onClick={d.onClick}
          />
        )
      })}
    </div>
  )
}
