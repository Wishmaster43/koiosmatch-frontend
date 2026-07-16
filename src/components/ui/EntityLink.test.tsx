import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntityLink from './EntityLink'
import { NavigationProvider } from '@/context/NavigationContext'

// Job 16 (2026-07-16): every cross-entity hyperlink shows a visible "opens
// elsewhere" affordance by default, with an opt-out for tight/inline spots —
// guards against the icon silently disappearing or the opt-out prop drifting.
describe('EntityLink', () => {
  it('renders the external-link icon by default and opens the target entity on click', async () => {
    const goTo = vi.fn()
    render(
      <NavigationProvider goTo={goTo}>
        <EntityLink page="vacancies" id="v-1">Verzorgende IG</EntityLink>
      </NavigationProvider>,
    )
    const link = screen.getByRole('button', { name: 'Verzorgende IG' })
    expect(link.querySelector('svg')).toBeTruthy()
    await userEvent.click(link)
    expect(goTo).toHaveBeenCalledWith('vacancies', { open: 'v-1' })
  })

  it('hides the icon when hideIcon is passed', () => {
    render(
      <NavigationProvider goTo={() => {}}>
        <EntityLink page="vacancies" id="v-1" hideIcon>Verzorgende IG</EntityLink>
      </NavigationProvider>,
    )
    expect(screen.getByRole('button', { name: 'Verzorgende IG' }).querySelector('svg')).toBeNull()
  })

  it('degrades to plain text (no button/icon) when there is no target id', () => {
    render(
      <NavigationProvider goTo={() => {}}>
        <EntityLink page="vacancies" id={null}>Verzorgende IG</EntityLink>
      </NavigationProvider>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Verzorgende IG')).toBeTruthy()
  })
})
