/**
 * ScopeEditor — audit finding: the permission-level control was a bare native
 * <select> instead of the shared SearchSelect (§4/§11). Covers the toggle-on/off
 * path, the level-picker trigger text, picking a level via SearchSelect, and that
 * an OFF row's level control is disabled (not just dimmed).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ScopeEditor from './ScopeEditor'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => cleanup())

describe('ScopeEditor', () => {
  it('toggling an entity on defaults its level to read', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeEditor value={{}} onChange={onChange} />)

    await user.click(screen.getAllByRole('switch')[0])
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ candidates: 'read' }))
  })

  it('shows the current level on the SearchSelect trigger for an enabled entity', () => {
    render(<ScopeEditor value={{ candidates: 'read_write' }} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidates') })).toHaveTextContent(st('apiKeys.level.read_write'))
  })

  it('disables the level trigger while the entity is off', () => {
    render(<ScopeEditor value={{}} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidates') })).toBeDisabled()
  })

  it('picking a level via SearchSelect reports the new map', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeEditor value={{ candidates: 'read' }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: st('apiKeys.scopes.candidates') }))
    await user.click(await screen.findByText(st('apiKeys.level.read_write')))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ candidates: 'read_write' }))
  })

  it('the five candidate dossier scopes render and toggle', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeEditor value={{}} onChange={onChange} />)

    // The five new scopes should render with their labels.
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidate_notes') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidate_documents') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidate_conversations') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidate_educations') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidate_references') })).toBeInTheDocument()

    // Toggling one of them on sends its key in the scopes body exactly like an existing one.
    const switches = screen.getAllByRole('switch')
    const candidateNotesSwitch = switches.find(s => {
      const parent = s.closest('div')
      return parent?.textContent?.includes(st('apiKeys.scopes.candidate_notes'))
    })

    await user.click(candidateNotesSwitch)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ candidate_notes: 'read' }))
  })
})

// SCOPE-LEVEL-READONLY-1: the backend's per-entity level hint narrows the picker; a single
// offered level renders as text (no dead picker), the default level follows the hint.
describe('ScopeEditor · offered levels (SCOPE-LEVEL-READONLY-1)', () => {
  it('renders a read-only entity as plain text instead of a picker', () => {
    render(<ScopeEditor value={{ company: 'read' }} onChange={() => {}} levelsByEntity={{ company: ['read'] }} />)
    expect(screen.queryByRole('button', { name: st('apiKeys.scopes.company') })).toBeNull()
    expect(screen.getByLabelText(st('apiKeys.scopes.company'))).toHaveTextContent(st('apiKeys.level.read'))
    // Other rows keep their picker.
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.candidates') })).toBeInTheDocument()
  })

  it('keeps a stored level the hint no longer offers pickable (visible and changeable)', () => {
    render(<ScopeEditor value={{ company: 'read_write' }} onChange={() => {}} levelsByEntity={{ company: ['read'] }} />)
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.company') })).toHaveTextContent(st('apiKeys.level.read_write'))
  })

  it('defaults a toggled-on entity to the first offered level', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeEditor value={{}} onChange={onChange} levelsByEntity={{ candidates: ['read_write'] }} />)
    await user.click(screen.getAllByRole('switch')[0])
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ candidates: 'read_write' }))
  })

  it('keeps every level when there is no hint (today\'s behaviour)', () => {
    render(<ScopeEditor value={{ company: 'read' }} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: st('apiKeys.scopes.company') })).toBeInTheDocument()
  })
})
