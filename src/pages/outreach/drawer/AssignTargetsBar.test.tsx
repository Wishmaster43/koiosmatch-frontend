/**
 * AssignTargetsBar — HUISSTIJL-1: the cancel control renders through the shared
 * Button (was a hand-styled raw <button> beside the real primary Button).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import AssignTargetsBar from './AssignTargetsBar'

vi.mock('@/lib/useTeams', () => ({ useTeams: () => ({ teams: [] }) }))
vi.mock('@/pages/users/shared', () => ({ useAssignableRoles: () => ({ roles: [] }) }))

describe('AssignTargetsBar · cancel control (HUISSTIJL-1)', () => {
  it('renders the cancel action through the shared Button and fires onDone', () => {
    const onDone = vi.fn()
    render(<AssignTargetsBar selection={{ ids: ['t1'] }} count={1} recruiters={[]}
      onAssign={vi.fn()} onDone={onDone} />)

    const cancel = screen.getByRole('button', { name: 'Annuleren' })
    fireEvent.click(cancel)
    expect(onDone).toHaveBeenCalled()
  })
})
