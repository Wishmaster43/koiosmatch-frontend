import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PendingGeocodeBanner from './PendingGeocodeBanner'

describe('PendingGeocodeBanner', () => {
  it('renders nothing when count is 0', () => {
    render(<PendingGeocodeBanner count={0} label="should not render" />)
    expect(screen.queryByTestId('pending-geocode-banner')).toBeNull()
  })

  it('renders the label inside the banner when count > 0', () => {
    render(<PendingGeocodeBanner count={3} label="3 pending" />)
    const banner = screen.getByTestId('pending-geocode-banner')
    expect(banner).toHaveTextContent('3 pending')
  })
})
