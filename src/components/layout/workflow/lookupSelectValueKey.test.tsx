/**
 * lookupSelectValueKey.test — the control-round regression of 13-08: a lookup
 * field whose SERVER matches on a named column (roles.name) must STORE that
 * column, not the numeric id the generic {value|id} fallback produces. A role
 * saved as "3" matches whereHas('roles', name = "3") → nobody, silently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LookupSelectField } from './fieldControls/LookupSelectField'

// Spatie roles come back as {id, name, ...} — deliberately NO value/label keys.
// Partial mock: only the transport is faked; unwrapList stays the REAL helper
// (mocking the whole module erased it, and the component's fail-soft .catch
// silently swallowed the resulting TypeError — empty dropdown, useless test).
vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: vi.fn().mockResolvedValue({ data: [
    { id: 3, name: 'admin', color: null },
    { id: 7, name: 'recruiter', color: null },
  ] }) },
}))

describe('LookupSelectField · valueKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it("stores the row's named column when valueKey is set (roles resolve by name)", async () => {
    const onChange = vi.fn()
    render(<LookupSelectField value={undefined} onChange={onChange} fieldKey="role" endpoint="/roles" valueKey="name" />)
    // Open the searchable picker and choose a role by its visible label.
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true'))
    const opt = await screen.findByText('admin')
    fireEvent.click(opt)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('role', 'admin'))
    expect(onChange).not.toHaveBeenCalledWith('role', '3')
  })

  it('keeps the historic {value|id} fallback when valueKey is absent', async () => {
    const onChange = vi.fn()
    render(<LookupSelectField value={undefined} onChange={onChange} fieldKey="status" endpoint="/candidate-statuses" />)
    fireEvent.click(screen.getByRole('button'))
    const opt = await screen.findByText('admin')
    fireEvent.click(opt)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('status', '3'))
  })
})

// LOOKUP-RESPONSEKEY-TEST-1: an endpoint like GET /settings/candidate-lookups
// returns an OBJECT of collections ({statuses, phases, …}), not a plain list —
// responseKey picks which collection to read; unwrapList would find nothing.
describe('LookupSelectField · responseKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the named collection out of an object-of-collections response', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.get).mockResolvedValueOnce({ data: {
      status_set: [
        { id: 1, name: 'Available' },
        { id: 2, name: 'Placed' },
      ],
      phases: [
        { id: 9, name: 'Lead' },
      ],
    } })
    const onChange = vi.fn()
    render(<LookupSelectField value={undefined} onChange={onChange} fieldKey="status" endpoint="/settings/candidate-lookups" responseKey="status_set" />)
    fireEvent.click(screen.getByRole('button'))
    const opt = await screen.findByText('Available')
    fireEvent.click(opt)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('status', '1'))
    // The sibling collection under a different key never leaks into these options.
    expect(screen.queryByText('Lead')).not.toBeInTheDocument()
  })
})
