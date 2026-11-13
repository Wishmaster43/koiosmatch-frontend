/**
 * HelloflexSettings — the Links sub-tab opens the links panel for the helloflex system.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import HelloflexSettings from './HelloflexSettings'

vi.mock('./IntegrationConnectionCard', () => ({ default: () => <div>connection</div> }))
vi.mock('./IntegrationMappingsTable', () => ({ default: () => <div>mappings</div> }))
vi.mock('../HelloflexContractMapSettings', () => ({ default: () => <div>contractmap</div> }))
vi.mock('./links/IntegrationLinksPanel', () => ({ default: ({ system }: { system: string }) => <div>links:{system}</div> }))

describe('HelloflexSettings', () => {
  // The Links tab sits after the existing tabs and mounts the panel with the preset system.
  it('shows the Links tab last and opens the helloflex links panel', async () => {
    render(<HelloflexSettings />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.at(-1)).toHaveTextContent(i18n.t('integrations.tabs.links', { ns: 'settings' }))
    await userEvent.click(tabs.at(-1)!)
    expect(screen.getByText('links:helloflex')).toBeInTheDocument()
  })
})
