/**
 * UserModalColumns — the shared two-column wide-form layout (left: identity/
 * credentials, right: role or branches) both NewUserModal and EditUserModal
 * spread their own cards into. Extracted alongside UserNameCard once the two
 * modals gained the identical wide-form scaffold (SETTINGS-INCON-B2, Danny
 * 13-09) and jscpd flagged the wrapper markup itself as a clone.
 */
import type { ReactNode } from 'react'
import { modalColumns } from '@/components/ui/modalCards'

const columnStyle = { display: 'flex', flexDirection: 'column' as const, gap: 14 }

export default function UserModalColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div style={modalColumns()}>
      <div style={columnStyle}>{left}</div>
      <div style={columnStyle}>{right}</div>
    </div>
  )
}
