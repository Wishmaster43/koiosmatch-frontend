/**
 * KoiosSettings section — sub-tab switch (C1-lane 2). Verifies the overview
 * (status/models) and learning tabs render exclusively per active tab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KoiosSettings from './index'

// Settings load is mocked — no live call (API-CREDITS-1).
const mockGetKoiosSettings = vi.fn()
vi.mock('./koiosApi', () => ({ getKoiosSettings: () => mockGetKoiosSettings() }))
vi.mock('@/components/layout/koios/useKoiosSettings', () => ({ invalidateKoiosSettings: vi.fn() }))

// Child cards stubbed to isolate the sub-tab switch under test.
vi.mock('./KoiosStatusCard', () => ({ default: () => <div>overview-status-card</div> }))
vi.mock('./KoiosModelsCard', () => ({ default: () => <div>overview-models-card</div> }))
vi.mock('./KoiosLearningCard', () => ({ default: () => <div>learning-card</div> }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

beforeEach(() => { mockGetKoiosSettings.mockReset() })

describe('KoiosSettings sub-tabs', () => {
  it('shows the overview cards by default and switches to the learning card on tab click', async () => {
    mockGetKoiosSettings.mockResolvedValue({ status: {}, models: {} })
    render(<KoiosSettings />)

    await screen.findByText('overview-status-card')
    expect(screen.getByText('overview-models-card')).toBeInTheDocument()
    expect(screen.queryByText('learning-card')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'tabs.learning' }))
    await waitFor(() => expect(screen.getByText('learning-card')).toBeInTheDocument())
    expect(screen.queryByText('overview-status-card')).not.toBeInTheDocument()
  })
})
