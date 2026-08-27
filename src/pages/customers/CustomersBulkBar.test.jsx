import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomersBulkBar from './CustomersBulkBar'

// BulkNoteModal's body is the shared RichTextEditor (real Tiptap); stub it with a
// plain textarea so this test drives the modal's own wiring, not Tiptap internals
// (mirrors EditableRichTextField.test.tsx's stub).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

// SYNC-BULK-1: the couple-to-backoffice node gates itself on permission (useAuth)
// + tenant app availability (useApps) — mocked so each test can drive both.
const mockUseAuth = vi.fn()
const mockUseApps = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))

// i18n is not initialised in tests → t() returns the key, so we drive/assert on keys.
const baseProps = () => ({
  count: 2, onClear: vi.fn(),
  onSetOwner: vi.fn(), onSetStatus: vi.fn(), onAddTag: vi.fn(),
  onRemoveTag: vi.fn(), onAddNote: vi.fn(), onArchive: vi.fn(),
  users: [{ id: 'u1', name: 'Iris de Wit' }, { id: 'u2', name: 'Kelly van Vliet' }],
  statuses: [{ value: 'actief', label: 'Actief' }, { value: 'prospect', label: 'Prospect' }],
  selectedTags: ['Zorg', 'Regio West'],
})

describe('CustomersBulkBar', () => {
  it('hides Archive unless the user may delete', async () => {
    const user = userEvent.setup()
    render(<CustomersBulkBar {...baseProps()} canArchive={false} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.getByText('bulk.changeOwner')).toBeInTheDocument()
    expect(screen.queryByText('bulk.archive')).toBeNull()
  })

  it('shows Archive and fires onArchive when permitted', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canArchive: true }
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.archive'))
    expect(props.onArchive).toHaveBeenCalledTimes(1)
  })

  it('resolves a picked account manager back to the full user object', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeOwner'))
    await user.click(screen.getByText('Iris de Wit'))
    expect(props.onSetOwner).toHaveBeenCalledWith({ id: 'u1', name: 'Iris de Wit' })
  })

  it('passes the chosen status value through', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStatus'))
    await user.click(screen.getByText('Actief'))
    expect(props.onSetStatus).toHaveBeenCalledWith('actief')
  })

  // GEO-REGEOCODE-1: bulk "PDOK opnieuw ophalen" — gated on customers.update
  // (canGeocode, set by the page from hasPermission), reuses the ONE shared
  // common:geocode.refresh label rather than a per-entity i18n key.
  it('hides the geocode action without customers.update', async () => {
    const user = userEvent.setup()
    render(<CustomersBulkBar {...baseProps()} canGeocode={false} onGeocode={vi.fn()} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.queryByText('common:geocode.refresh')).toBeNull()
  })

  it('shows the geocode action and fires onGeocode when permitted', async () => {
    const user = userEvent.setup()
    const onGeocode = vi.fn()
    render(<CustomersBulkBar {...baseProps()} canGeocode onGeocode={onGeocode} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('common:geocode.refresh'))
    expect(onGeocode).toHaveBeenCalledTimes(1)
  })

  // NOTITIE-RTE-VRAAG-1: bulk add-note opens the shared rich-text modal instead
  // of ActionMenu's bare input node; submitting calls onAddNote with the HTML.
  it('opens the shared note modal and calls onAddNote with the entered content', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.addNote'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(screen.getByTestId('rte'), 'Hello there')
    await user.click(screen.getByText('bulk.noteSubmit'))

    expect(props.onAddNote).toHaveBeenCalledTimes(1)
    expect(props.onAddNote.mock.calls[0][0]).toContain('Hello there')
  })

  // SYNC-BULK-1: bulk backoffice coupling — gated on the SAME permission as the
  // per-record BackofficeLinksTab (customers.update) + tenant app availability
  // (hf/shiftmanager), never a new permission and never a switched-off system.
  describe('SYNC-BULK-1 · couple to backoffice', () => {
    it('hides the couple action without customers.update, even with both systems enabled', async () => {
      mockUseAuth.mockReturnValue({ hasPermission: () => false })
      mockUseApps.mockReturnValue({ isAppEnabled: () => true })
      const user = userEvent.setup()
      render(<CustomersBulkBar {...baseProps()} onCoupleBackoffice={vi.fn()} />)
      await user.click(screen.getByText('bulk.actions'))
      expect(screen.queryByText('bulk.couple')).toBeNull()
    })

    it('hides the couple action when permitted but neither backoffice app is enabled', async () => {
      mockUseAuth.mockReturnValue({ hasPermission: () => true })
      mockUseApps.mockReturnValue({ isAppEnabled: () => false })
      const user = userEvent.setup()
      render(<CustomersBulkBar {...baseProps()} onCoupleBackoffice={vi.fn()} />)
      await user.click(screen.getByText('bulk.actions'))
      expect(screen.queryByText('bulk.couple')).toBeNull()
    })

    it('offers only the enabled system (HelloFlex on, Shiftmanager off) and fires the callback with the right system', async () => {
      mockUseAuth.mockReturnValue({ hasPermission: () => true })
      mockUseApps.mockReturnValue({ isAppEnabled: (id) => id === 'hf' })
      const user = userEvent.setup()
      const onCoupleBackoffice = vi.fn()
      render(<CustomersBulkBar {...baseProps()} onCoupleBackoffice={onCoupleBackoffice} />)
      await user.click(screen.getByText('bulk.actions'))
      await user.click(screen.getByText('bulk.couple'))
      expect(screen.queryByText('common:backofficeLinks.shiftmanager.name')).toBeNull()
      await user.click(screen.getByText('common:backofficeLinks.helloflex.name'))
      expect(onCoupleBackoffice).toHaveBeenCalledWith('helloflex')
    })
  })
})
