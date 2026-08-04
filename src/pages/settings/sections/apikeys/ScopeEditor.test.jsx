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
})
