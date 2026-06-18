/**
 * ModuleView — renders a module's configured KPI blocks on a dashboard/report.
 *
 * The layout (which blocks, in what order) comes from the saved per-module view
 * config; the live values come from the caller via `data` (keyed by block id):
 *   data[blockId] = { value, sub?, onClick? }
 *
 * Adding/removing/reordering a block is done in Settings → Views, never here.
 */
import KpiBlock from '../ui/KpiBlock'
import { useModuleView } from '../../lib/settings/useModuleView'

export default function ModuleView({ module, data = {}, loading = false }) {
  const blocks = useModuleView(module)
  const kpis = blocks.filter(b => b.type === 'kpi')
  if (kpis.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 12 }}>
      {kpis.map(b => {
        const d = data[b.id] ?? {}
        return (
          <KpiBlock
            key={b.id}
            label={b.label}
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
