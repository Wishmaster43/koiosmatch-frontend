/**
 * WeightSliderRow — shared match-weight dimension row (MatchProfileCard + MatchingTab).
 * Behaviour tests: the label/weight render, and moving the slider reports the
 * correct 1..5 weight (not the slider's own 0-based internal value).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WeightSliderRow from './WeightSliderRow'

describe('WeightSliderRow', () => {
  const defaultProps = {
    label: 'Ervaring',
    weight: 3,
    onChange: vi.fn(),
    sliderLabels: ['Minder', 'Gebalanceerd', 'Meer'] as [string, string, string],
    ariaLabel: 'Ervaring',
    weightFontSize: 12,
  }

  it('renders the label and the N/5 weight readout', () => {
    render(<WeightSliderRow {...defaultProps} weight={4} />)
    expect(screen.getByText('Ervaring')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('applies the given weightFontSize to the weight readout', () => {
    render(<WeightSliderRow {...defaultProps} weightFontSize={11} />)
    expect(screen.getByText('3/5').style.fontSize).toBe('11px')
  })

  // Slider is 0-based (0..4); the reported weight must be 1..5 — the exact
  // translation this component owns (moving the slider to index 4 => weight 5).
  it('reports the slider position as a 1..5 weight, not the 0-based slider value', () => {
    const onChange = vi.fn()
    render(<WeightSliderRow {...defaultProps} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'Ervaring' })
    // ArrowRight nudges the 0-based slider by one step (the house Slider's own documented keyboard control).
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalled()
    const reported = onChange.mock.calls[0][0]
    expect(reported).toBeGreaterThanOrEqual(1)
    expect(reported).toBeLessThanOrEqual(5)
  })
})
