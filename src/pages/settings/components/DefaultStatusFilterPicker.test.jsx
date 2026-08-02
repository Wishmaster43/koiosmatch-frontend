/**
 * DefaultStatusFilterPicker (TENANT-DEFAULT-1, Danny 02-08 — second review pass):
 * a `SelectMenu` dropdown, this product's own pattern for "pick one from a tenant
 * lookup" — never a hand-rolled radio group. It must ALWAYS show the value really
 * in effect: the stored setting if one exists, otherwise the exact guess
 * `useStatusFilter` would apply today (or "All" when no active-like status exists)
 * — never an empty/unconfigured-looking state while the live tab is, in fact,
 * already filtering.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DefaultStatusFilterPicker from './DefaultStatusFilterPicker'

const st = (key) => i18n.t(key, { ns: 'settings' })

const statuses = [
  { id: 's-active', value: 'active', label: 'Actief' },
  { id: 's-inactive', value: 'inactive', label: 'Inactief' },
]

describe('DefaultStatusFilterPicker · always shows the value really in effect', () => {
  it('preselects the guessed active-like status when nothing is saved, and says so', () => {
    render(<DefaultStatusFilterPicker statuses={statuses} value={null} onChange={vi.fn()} />)
    // The trigger shows "Actief" — the tab's real current behaviour — not a blank/placeholder.
    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.getByText(st('customerDisplay.defaultFilter.autoHint'))).toBeInTheDocument()
  })

  it('preselects "All statuses" when nothing is saved AND no active-like status exists', () => {
    const noActiveStatuses = [{ id: 's-lopend', value: 'lopend', label: 'Lopend' }]
    render(<DefaultStatusFilterPicker statuses={noActiveStatuses} value={null} onChange={vi.fn()} />)
    expect(screen.getByText(st('customerDisplay.defaultFilter.allOption'))).toBeInTheDocument()
  })

  it('shows the tenant-saved status, not the guess, once one is configured', () => {
    render(<DefaultStatusFilterPicker statuses={statuses} value="s-inactive" onChange={vi.fn()} />)
    expect(screen.getByText('Inactief')).toBeInTheDocument()
    expect(screen.queryByText('Actief')).toBeNull()
    expect(screen.getByText(st('customerDisplay.defaultFilter.chosenHint'))).toBeInTheDocument()
  })

  it('shows "All statuses" as a real saved choice, distinct from "not configured"', () => {
    render(<DefaultStatusFilterPicker statuses={statuses} value="all" onChange={vi.fn()} />)
    expect(screen.getByText(st('customerDisplay.defaultFilter.allOption'))).toBeInTheDocument()
    // Chosen, not guessed — the copy must say so even though "all" also happens to be
    // what an absent setting could resolve to on a tenant with no active-like status.
    expect(screen.getByText(st('customerDisplay.defaultFilter.chosenHint'))).toBeInTheDocument()
  })
})

describe('DefaultStatusFilterPicker · a dropdown, not a radio group', () => {
  it('renders no radio inputs at all', () => {
    render(<DefaultStatusFilterPicker statuses={statuses} value={null} onChange={vi.fn()} />)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('picking another option calls onChange with that status id', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DefaultStatusFilterPicker statuses={statuses} value="s-active" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Actief/ }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    expect(onChange).toHaveBeenCalledWith('s-inactive')
  })

  it('picking "All statuses" calls onChange with the STATUS_FILTER_ALL sentinel', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DefaultStatusFilterPicker statuses={statuses} value="s-active" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Actief/ }))
    await user.click(screen.getByRole('button', { name: st('customerDisplay.defaultFilter.allOption') }))
    expect(onChange).toHaveBeenCalledWith('all')
  })
})
