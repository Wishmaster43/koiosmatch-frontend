/**
 * VacancyGenerationSettings — the thin container: verifies the internal
 * Profiles/Reusable-blocks sub-tab actually switches which CRUD list renders
 * (the two lists themselves are covered by their own test files).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import VacancyGenerationSettings from './VacancyGenerationSettings'

vi.mock('./VacancyGenerationProfilesList', () => ({ default: () => <div>profiles-list</div> }))
vi.mock('./VacancyContentBlocksSettings', () => ({ default: () => <div>blocks-list</div> }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

describe('VacancyGenerationSettings', () => {
  it('shows the profiles list by default and the title/subtitle', () => {
    render(<VacancyGenerationSettings />)
    expect(screen.getByText(st('vacancyGenerationSettings.title'))).toBeInTheDocument()
    expect(screen.getByText('profiles-list')).toBeInTheDocument()
    expect(screen.queryByText('blocks-list')).not.toBeInTheDocument()
  })

  it('switches to the reusable-blocks list on tab click', async () => {
    const user = userEvent.setup()
    render(<VacancyGenerationSettings />)
    await user.click(screen.getByRole('tab', { name: st('vacancyGenerationSettings.tabBlocks') }))
    expect(screen.getByText('blocks-list')).toBeInTheDocument()
    expect(screen.queryByText('profiles-list')).not.toBeInTheDocument()
  })
})
