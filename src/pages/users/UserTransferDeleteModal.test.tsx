/**
 * UserTransferDeleteModal — the dialog must SHOW what is at stake (how many
 * records and of which types, straight from the server's `owned.by_type`) and
 * must not allow a delete without a successor. Anything less would be the
 * "generic error / orphaning delete" this feature exists to prevent.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserTransferDeleteModal from './UserTransferDeleteModal'
import type { ManagedUser } from '@/types/api'

// Keep the interpolated count visible so the assertions can prove it is rendered.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o && 'count' in o ? `${k}#${o.count}` : k),
  }),
}))

const target: ManagedUser = { id: 'u1', firstname: 'Kelly', lastname: 'Yesway', email: 'kelly@yesway.nl' }
const successors: ManagedUser[] = [
  { id: 'u2', firstname: 'Ravi', lastname: 'Yesway', email: 'ravi@yesway.nl' },
  { id: 'u3', firstname: 'Laura', lastname: 'Yesway', email: 'laura@yesway.nl' },
]
// Measured shape: only non-zero types come back, keyed by tenant table name.
const owned = { total: 131, by_type: { candidates: 112, vacancies: 18, tasks: 1 } }
const noop = () => {}

describe('UserTransferDeleteModal', () => {
  it('names every owned object type with its own count', () => {
    render(<UserTransferDeleteModal user={target} owned={owned} successors={successors}
      busy={false} onConfirm={noop} onClose={noop} />)

    expect(screen.getByText('delete.types.candidates#112')).toBeInTheDocument()
    expect(screen.getByText('delete.types.vacancies#18')).toBeInTheDocument()
    expect(screen.getByText('delete.types.tasks#1')).toBeInTheDocument()
    // The grand total rides along in the explanation line.
    expect(screen.getByText('delete.explain#131')).toBeInTheDocument()
  })

  it('falls back to a translated generic line for an unmapped object type', () => {
    render(<UserTransferDeleteModal user={target} owned={{ total: 2, by_type: { widgets: 2 } }}
      successors={successors} busy={false} onConfirm={noop} onClose={noop} />)

    expect(screen.getByText('delete.types.other#2')).toBeInTheDocument()
  })

  it('blocks confirming until a successor is picked, then hands that id up', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<UserTransferDeleteModal user={target} owned={owned} successors={successors}
      busy={false} onConfirm={onConfirm} onClose={noop} />)

    const confirmBtn = screen.getByText('delete.confirm').closest('button')
    expect(confirmBtn).toBeDisabled()

    // The successor picker is the house searchable dropdown, never a native select.
    expect(document.querySelector('select')).toBeNull()
    await user.click(screen.getByText('delete.successorPlaceholder'))
    await user.click(await screen.findByText('Ravi Yesway'))

    await waitFor(() => expect(screen.getByText('delete.confirm').closest('button')).toBeEnabled())
    await user.click(screen.getByText('delete.confirm'))

    expect(onConfirm).toHaveBeenCalledWith('u2')
  })
})
