/**
 * ConnectorTabsShell — the shared frame of a connector section: the underline
 * SubTabBar above the active tab's content (HelloFlex and Shiftmanager use it).
 */
import type { ReactNode } from 'react'
import SubTabBar from '@/components/drawer/SubTabBar'

interface Props {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  children: ReactNode
}

// Tab bar plus the active tab's content in one column.
export default function ConnectorTabsShell({ tabs, active, onChange, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SubTabBar tabs={tabs} active={active} onChange={onChange} />
      {children}
    </div>
  )
}
