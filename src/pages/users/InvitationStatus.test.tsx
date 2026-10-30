/**
 * InvitationStatus — the sentence carries both dates as DD-MM-YYYY, the table icon
 * exists for pending/expired only (BE FOLLOW-UP-2910-1 item 2).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvitationStatusRow, InvitationIcon } from './InvitationStatus'
import type { UserInvitation } from '@/types/api'

// Key echo that also exposes the interpolation params so the formatted dates are assertable.
vi.mock('react-i18next', async importOriginal => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}|${o.sent}|${o.expires}` : k) }),
}))

const inv = (status: UserInvitation['status']): UserInvitation => ({
  status, sent_at: '2026-10-01T10:00:00Z', expires_at: '2026-10-08T10:00:00Z', can_resend: true,
})

describe('InvitationStatusRow', () => {
  it('shows the pending key with both dates as DD-MM-YYYY', () => {
    render(<InvitationStatusRow invitation={inv('pending')} />)
    expect(screen.getByText('invite.statusLabel')).toBeInTheDocument()
    expect(screen.getByText('invite.status.pending|01-10-2026|08-10-2026')).toBeInTheDocument()
  })
  it('renders nothing without an invitation', () => {
    const { container } = render(<InvitationStatusRow />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('InvitationIcon', () => {
  it.each(['pending', 'expired'] as const)('labels the %s icon with the status sentence', status => {
    render(<InvitationIcon invitation={inv(status)} />)
    expect(screen.getByRole('img', { name: new RegExp(`^invite\\.status\\.${status}\\|`) })).toBeInTheDocument()
  })
  it.each(['accepted', 'none'] as const)('shows nothing for %s', status => {
    render(<InvitationIcon invitation={inv(status)} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
