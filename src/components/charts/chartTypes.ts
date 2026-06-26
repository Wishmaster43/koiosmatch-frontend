/** Shared chart shapes — one bucket of data and the recharts tooltip props. */
import type { ReactNode } from 'react'

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
