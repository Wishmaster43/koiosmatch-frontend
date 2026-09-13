/**
 * chartSelection — the shared donut/bar-chart click-to-filter helpers used by
 * every entity's insights config builder: `pickKey` normalises Recharts' click
 * payload (top-level or nested under `.payload`), and `toggleOneValue` sets a
 * multi-select filter to exactly one value, clearing it when the same segment
 * is clicked again. Hand-copied identically across customers/vacancies before
 * this consolidation.
 */
import type { Dispatch, SetStateAction } from 'react'

// Recharts hands the clicked segment back at top level AND under `.payload`.
export const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key ?? o?.name
}

// Set exactly one value in a multi-select, or clear when it's already the only one.
export const toggleOneValue = (set: Dispatch<SetStateAction<string[]>>, value: string) =>
  set(p => (p.length === 1 && p[0] === value) ? [] : [value])
