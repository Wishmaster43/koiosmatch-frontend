/**
 * ViewSwitch — swap between named page views (tabel/kaart/bord) without
 * unmounting them. WHY: a virtualized DataTable (@tanstack/react-virtual keyed
 * off a scrollParentRef) measures 0 height when its scroll container remounts —
 * ternary-unmounting the table on a view toggle left it empty on return
 * (APPS-VIRT-1, commit 77dc110). Each view mounts on its first activation and
 * then stays in the tree forever, toggling `display: contents` (shown) /
 * `display: none` (hidden) instead of unmounting — so the virtualizer's
 * measurements (and any other view's scroll/drag state) survive every toggle.
 * Views never activated (e.g. an unopened, lazy-loaded map) are never mounted,
 * so this doesn't defeat route-level code-splitting (§9).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'

export interface ViewSwitchEntry {
  id: string
  render: () => ReactNode
}

interface ViewSwitchProps {
  active: string
  views: ViewSwitchEntry[]
}

export default function ViewSwitch({ active, views }: ViewSwitchProps) {
  // Track which view ids have ever been the active one, so each mounts once
  // and stays mounted. Adjusting state during render (never a ref — refs must
  // not be read/written during render) is the React-endorsed way to derive this
  // without an effect: https://react.dev/learn/you-might-not-need-an-effect.
  const [mountedIds, setMountedIds] = useState<ReadonlySet<string>>(() => new Set([active]))
  if (!mountedIds.has(active)) {
    setMountedIds(prev => new Set(prev).add(active))
  }

  return (
    <>
      {views.filter(v => mountedIds.has(v.id)).map(v => (
        <div key={v.id} style={{ display: v.id === active ? 'contents' : 'none' }}>
          {v.render()}
        </div>
      ))}
    </>
  )
}
