/**
 * CandidateOriginCard — "Herkomst": source, created-by and created-on live
 * TOGETHER in one read-only block (Danny 09-08, "ik mis de bron"). Before this
 * card existed, the source sat alone in the "Persoonlijk" card while the two
 * stamps sat in the drawer footer — a split that made the source unfindable,
 * because in Persoonlijk it read as a property of the PERSON, not the DOSSIER.
 *
 * These tests pin two things that are easy to lose silently in a refactor:
 * (1) the block is fully read-only — no pencil, no save/cancel, no input at
 *     all (Danny 09-08, "Herkomst geen potloodje"); and
 * (2) a missing value renders the shared placeholder dash, never an invented
 *     word like "onbekend"/"unknown".
 *
 * Real i18n instance (like the rest of this drawer's tests), asserting on
 * translated text from the locale files rather than hardcoded Dutch literals.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import CandidateOriginCard from './CandidateOriginCard'
import type { Candidate } from '@/types/candidate'

// Labels resolved through i18n itself, not hardcoded: these assertions hold
// whether the copy is Dutch, English or a future rewording.
const TITLE_LABEL = i18n.t('candidates:profile.groupOrigin')
const SOURCE_LABEL = i18n.t('candidates:profile.source')
const CREATED_BY_LABEL = i18n.t('candidates:profile.createdBy')
const CREATED_AT_LABEL = i18n.t('candidates:profile.createdAt')

const candidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, ...overrides } as unknown as Candidate)

describe('CandidateOriginCard · the three Herkomst lines', () => {
  it('renders the title and the three rows with their values', () => {
    render(<CandidateOriginCard c={candidate({
      source: 'werkzoeken',
      createdBy: { id: 7, name: 'Laura Yesway' },
      created: '2025-10-29T16:03:57',
    })} />)
    expect(screen.getByText(TITLE_LABEL)).toBeInTheDocument()
    expect(screen.getByText(SOURCE_LABEL)).toBeInTheDocument()
    expect(screen.getByText('werkzoeken')).toBeInTheDocument()
    expect(screen.getByText(CREATED_BY_LABEL)).toBeInTheDocument()
    expect(screen.getByText('Laura Yesway')).toBeInTheDocument()
    expect(screen.getByText(CREATED_AT_LABEL)).toBeInTheDocument()
    // DD-MM-YYYY + time via the shared lib/datetime formatter — never a hand-built string.
    expect(screen.getByText(/29-10-2025, 16:03/)).toBeInTheDocument()
  })

  // Danny 09-08: "Herkomst geen potloodje" — the whole block has no edit path at
  // all, unlike every other profile card. A stray pencil here would invite
  // editing history, which is exactly what this block must not allow.
  it('has no pencil, no save/cancel and no input — fully read-only', () => {
    const { container } = render(<CandidateOriginCard c={candidate({
      source: 'werkzoeken', createdBy: { id: 7, name: 'Laura Yesway' }, created: '2025-10-29T16:03:57',
    })} />)
    expect(screen.queryByTitle('Bewerken')).toBeNull()
    expect(screen.queryByTitle('Opslaan')).toBeNull()
    expect(screen.queryByTitle('Annuleren')).toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0)
  })

  // A missing value must show the shared placeholder dash, never a made-up word
  // — mirrors the footer's "never door onbekend" regression guard. The base
  // fixture already carries no source/createdBy/created, so no override needed.
  it('shows the placeholder dash for a missing value, never invented text', () => {
    render(<CandidateOriginCard c={candidate()} />)
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(3)
    expect(screen.queryByText(/onbekend|unknown/i)).toBeNull()
  })
})
