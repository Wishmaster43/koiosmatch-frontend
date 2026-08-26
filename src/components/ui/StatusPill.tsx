/**
 * StatusPill — status label with a resolved colour (candidate list/drawer et al).
 * Thin alias over SoftChip since the C-CHIP unification (2026-07-06): ONE chip
 * component owns the soft-tint look; this keeps older call sites compiling.
 */
import type { ReactNode } from 'react'
import SoftChip from './SoftChip'

interface StatusPillProps {
  label?: ReactNode
  color?: string | null
}

// Thin alias over the shared SoftChip (rounded), so every status pill in the app shares one implementation.
export default function StatusPill({ label, color }: StatusPillProps) {
  return <SoftChip label={label} color={color} round />
}
