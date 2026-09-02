import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchScoreBlock from './MatchScoreBlock'

// Deterministic key-echo (repo-wide precedent) — avoids depending on the real,
// async-initialising i18n instance for this pure-component test.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

// V17 (Danny 25-07): ApplicationTab suppresses the plain overall %+bar (it
// duplicated ApplicationStatusStrip's own match-score cell) via showOverall=false,
// while every other caller (default true) keeps seeing it unchanged.
describe('MatchScoreBlock · showOverall (V17)', () => {
  it('shows the overall % + bar by default', () => {
    render(<MatchScoreBlock score={82} criteria={[]} />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('hides the overall % + bar when showOverall=false, but keeps criteria', () => {
    render(<MatchScoreBlock score={82} criteria={[{ key: 'c1', label: 'Skills', score: 60 }]} showOverall={false} />)
    expect(screen.queryByText('82%')).not.toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
  })

  it('still reveals the overall % + edit sliders once editing starts, even with showOverall=false', async () => {
    const user = userEvent.setup()
    render(<MatchScoreBlock score={82} criteria={[]} showOverall={false} onSave={vi.fn()} />)
    expect(screen.queryByText('82%')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('matchScore.edit'))
    expect(screen.getByText('82%')).toBeInTheDocument()
  })
})

// AI-ACT-1: the score/criteria are Koios AI output unless a human already
// overrode them — the disclosure label must track that, not just render always.
describe('MatchScoreBlock · AI-Act disclosure label', () => {
  it('shows the AI-generated label when the score has no manual override', () => {
    render(<MatchScoreBlock score={82} criteria={[]} />)
    expect(screen.getByText('aiGenerated')).toBeInTheDocument()
  })

  it('hides the label once the score was manually overridden', () => {
    render(<MatchScoreBlock score={82} criteria={[]} source="manual" aiScore={70} />)
    expect(screen.queryByText('aiGenerated')).toBeNull()
    // The manual-override note still names the original AI score (existing behaviour).
    expect(screen.getByText('matchScore.manualNote')).toBeInTheDocument()
  })

  it('hides the label while a manual edit is in progress', async () => {
    const user = userEvent.setup()
    render(<MatchScoreBlock score={82} criteria={[]} onSave={vi.fn()} />)
    expect(screen.getByText('aiGenerated')).toBeInTheDocument()
    await user.click(screen.getByTitle('matchScore.edit'))
    expect(screen.queryByText('aiGenerated')).toBeNull()
  })

// S10/S28 (02-09): the "Hard" pill explains itself (knock-out) and the weight dots
// carry a persistent legend — a user must never have to guess what either means.
describe('MatchScoreBlock · hard hint + weight legend (S10/S28)', () => {
  it('gives the Hard pill the knock-out explanation as title and accessible name', () => {
    render(<MatchScoreBlock score={40} criteria={[{ key: 'c1', label: 'Rijbewijs', score: 20, hard: true, weight: 5 }]} />)
    // Key-echo t() above: the pill shows the label key and carries the hint key.
    const pill = screen.getByText('matchScore.hard')
    expect(pill.getAttribute('title')).toBe('matchScore.hardHint')
    expect(pill.getAttribute('aria-label')).toBe('matchScore.hard: matchScore.hardHint')
  })

  it('shows the weight legend once a criterion carries a weight, never for weightless criteria', () => {
    const { unmount } = render(<MatchScoreBlock score={40} criteria={[{ key: 'c1', label: 'Skills', score: 60, weight: 3 }]} />)
    expect(screen.getByText('matchScore.weightLegend')).toBeInTheDocument()
    unmount()
    render(<MatchScoreBlock score={40} criteria={[{ key: 'c2', label: 'Skills', score: 60 }]} />)
    expect(screen.queryByText('matchScore.weightLegend')).toBeNull()
  })
})
})
