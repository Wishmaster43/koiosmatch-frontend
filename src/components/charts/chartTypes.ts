/** Shared chart shapes — one bucket of data and the recharts tooltip props. */
import type { ReactNode } from 'react'

/* eslint-disable no-restricted-syntax -- fixed chart colour series, not UI styling: needs more distinct hues than the semantic token set provides */
// The house fallback series for chart slices/bars whose data carries no lookup
// colour of its own — ONE palette, shared by PieChartCard and every report
// chart that mixes tenant lookup colours with fallbacks.
export const CHART_SERIES_COLORS = [
  'var(--color-primary)','#10B981','#3B8FD4','var(--color-warning)',
  'var(--color-danger)','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899',
]
/* eslint-enable no-restricted-syntax */

export interface ChartDatum { name: string; value: number; key?: string; color?: string; [k: string]: unknown }

// A recharts tooltip payload entry (only the fields our tooltips read).
export interface TipEntry {
  value?: number
  name?: string
  color?: string
  fill?: string
  dataKey?: string | number
  payload?: { fill?: string }
}

// Props recharts injects into a custom Tooltip `content` element.
export interface TipProps { active?: boolean; payload?: TipEntry[]; label?: ReactNode }
