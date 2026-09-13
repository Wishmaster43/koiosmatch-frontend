import type { ReactNode } from 'react'

/**
 * SubEntityPanelWrapper — the flex column wrapper a drill-down steps aside to
 * once a nested panel (contacts/departments) took over the full trail
 * (DepartmentDetail/LocationDetail, DRY round CANDTABS package): one title,
 * one delete button, one way back — this level renders nothing of its own.
 */
export default function SubEntityPanelWrapper({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
}
