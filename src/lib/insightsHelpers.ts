import type { Dispatch, SetStateAction } from 'react'

// Donut click → set exactly one filter value (or clear when clicking it again).
export const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}
