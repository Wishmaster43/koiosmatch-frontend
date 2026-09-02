/**
 * hubLayout — the ONE block body every #reports hub block renders its content
 * in. Danny 02-09 on the first hub: "alle blokken even groot maken" — a block's
 * height used to follow its content (line chart 200px, bar chart taller, empty
 * state shorter, the attention list five rows), so rows never lined up. Every
 * block now fills the same fixed content height; state blocks centre inside it,
 * charts and the list sit at the top, an overlong list scrolls.
 */
import type { ReactNode } from 'react'

// Fixed content height shared by every hub block (charts are ≤ 240px tall).
export const HUB_BLOCK_HEIGHT = 260

// The block title row: title left, optional action right, and ALWAYS the
// Button-sm height (28px) — a block without an action must not end up 10px
// shorter than its neighbours (measured on the first hub: 328 vs 338px).
export function HubBlockTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>
      <span>{children}</span>
      {action}
    </div>
  )
}

// The block body: same height everywhere; `centered` for loading/error/empty states.
export function HubBlockBody({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <div style={{ height: HUB_BLOCK_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: centered ? 'center' : 'flex-start', overflowY: 'auto', overflowX: 'hidden' }}>
      {children}
    </div>
  )
}
