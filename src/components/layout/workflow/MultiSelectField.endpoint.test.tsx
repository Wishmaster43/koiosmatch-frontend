/**
 * MultiSelectField · endpoint mode (WF-BUILDER-VELDEN-1) — notification_send's
 * user_ids field fetches its options from GET /users instead of a tenant lookup or a
 * static list. Regression coverage for the loading → options → select path. Assertions
 * stay STRUCTURAL (never on translated text) — this suite runs without an i18n
 * instance, same convention as the sibling MultiSelectField.selectAll.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MultiSelectField from './MultiSelectField'
import type { WorkflowField } from '@/types/workflow'

// The multi-select reads tenant lookups through LookupsContext even in endpoint mode
// (the hook is called unconditionally) — stubbed empty, unused by this field.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ statuses: [], phases: [], candidateTypes: [] }),
}))

// Users come back as {id, name, ...} (UserResource) — no value/label keys, same shape
// lookupSelectValueKey.test.tsx exercises for LookupSelectField.
vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: vi.fn().mockResolvedValue({ data: [
    { id: 'u1', name: 'Anna' },
    { id: 'u2', name: 'Bram' },
  ] }) },
}))

const field = { key: 'user_ids', label: 'Gebruikers', type: 'multiselect', endpoint: '/users' } as unknown as WorkflowField

describe('MultiSelectField · endpoint-backed options', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the fetched options once GET /users resolves', async () => {
    render(<MultiSelectField field={field} value={[]} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('textbox'))

    // Not yet loaded: neither option is on the page.
    expect(screen.queryByText('Anna')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())
    expect(screen.getByText('Bram')).toBeInTheDocument()
  })

  it('selecting an option stores the id, not the display name', async () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('textbox'))

    const opt = await screen.findByText('Anna')
    fireEvent.click(opt)
    expect(onChange).toHaveBeenCalledWith('user_ids', ['u1'])
  })

  it('never adds a free-entry chip from typed text (an endpoint field is never free entry)', async () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={[]} onChange={onChange} />)
    const box = screen.getByRole('textbox')
    fireEvent.click(box)
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())

    fireEvent.change(box, { target: { value: 'not-a-real-user' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
