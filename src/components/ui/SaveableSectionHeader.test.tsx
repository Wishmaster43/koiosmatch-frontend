import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SaveableSectionHeader from './SaveableSectionHeader'

// SaveableSectionHeader is the shared title/subtitle + SaveButton row (VacancyMatchingSettings, MatchingTab).
describe('SaveableSectionHeader', () => {
  it('renders title, subtitle and the save label, and fires onSave', () => {
    const onSave = vi.fn()
    render(<SaveableSectionHeader title={<h2>Matching</h2>} subtitle="Tune the weights" saved={false}
      onSave={onSave} savedLabel="Saved" saveLabel="Save" />)
    expect(screen.getByText('Matching')).toBeInTheDocument()
    expect(screen.getByText('Tune the weights')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows the saved label once saved is true', () => {
    render(<SaveableSectionHeader title={<h2>Matching</h2>} subtitle="Tune the weights" saved
      onSave={() => {}} savedLabel="Saved" saveLabel="Save" />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })
})
