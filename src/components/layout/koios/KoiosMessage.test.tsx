/**
 * KoiosMessage — KOIOS-FEEDBACK-FE-1 coverage: the vote widget renders only
 * when the message carries a `prompt_log_id`, and never on the user's own
 * bubble or on a welcome/error/forbidden notice. KOIOS-CHAT-SIGNALS-FE-1 part (c):
 * search results are grouped by entity type with per-entity metadata.
 * Uses the real i18n instance (SCHERMWAARHEID-1 §5) so new-key fallback copy is what gets asserted.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosMessage from './KoiosMessage'
import type { KoiosChatMessage } from '@/types/koios'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string
const upLabel = t('koios.feedback.up', { defaultValue: 'Nuttig' })

const reply = (over: Partial<KoiosChatMessage> = {}): KoiosChatMessage => ({
  role: 'assistant', answer: 'Hallo daar', ...over,
})

describe('KoiosMessage — feedback gate', () => {
  it('renders the feedback widget when the reply carries a prompt_log_id', () => {
    render(<KoiosMessage msg={reply({ prompt_log_id: 'pl-1' })} t={t} />)
    expect(screen.getByLabelText(upLabel)).toBeInTheDocument()
  })

  it('renders nothing when the reply carries no prompt_log_id', () => {
    render(<KoiosMessage msg={reply()} t={t} />)
    expect(screen.queryByLabelText(upLabel)).not.toBeInTheDocument()
  })

  it('never shows feedback on the user\'s own bubble', () => {
    render(<KoiosMessage msg={{ role: 'user', content: 'Hoi', prompt_log_id: 'pl-2' }} t={t} />)
    expect(screen.queryByLabelText(upLabel)).not.toBeInTheDocument()
  })

  it('never shows feedback on a notice message (e.g. forbidden)', () => {
    render(<KoiosMessage msg={reply({ kind: 'forbidden', prompt_log_id: 'pl-3' })} t={t} />)
    expect(screen.queryByLabelText(upLabel)).not.toBeInTheDocument()
  })
})

describe('KoiosMessage — search results grouping', () => {
  it('groups refs by entity type from a zoek_alles step', () => {
    const mockT = (key: string) => {
      const map: Record<string, string> = {
        'koios.results.group.candidates': 'Candidates',
        'koios.results.group.vacancies': 'Vacancies',
      }
      return map[key] || key
    }
    const msg: KoiosChatMessage = {
      role: 'assistant',
      answer: 'Found some results',
      steps: [
        {
          tool: 'zoek_alles',
          refs: [
            { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
            { type: 'candidate', id: 'c2', label: 'Maria García' },
            { type: 'vacancy', id: 'v1', label: 'Verpleegkundige' },
          ],
        },
      ],
    }
    render(<KoiosMessage msg={msg} t={mockT} />)
    // Both candidate and vacancy group labels should render with counts
    expect(screen.getByText('Kandidaten (2)')).toBeInTheDocument()
    expect(screen.getByText('Vacatures (1)')).toBeInTheDocument()
  })

  // KOIOS-EN-1 phase A: the tool id is now English (search_all) — canonicalToolId
  // still detects the step, so grouping keeps working unchanged.
  it('groups refs by entity type from a search_all step (English tool id)', () => {
    const mockT = (key: string) => {
      const map: Record<string, string> = {
        'koios.results.group.candidates': 'Candidates',
        'koios.results.group.vacancies': 'Vacancies',
      }
      return map[key] || key
    }
    const msg: KoiosChatMessage = {
      role: 'assistant',
      answer: 'Found some results',
      steps: [
        {
          tool: 'search_all',
          refs: [
            { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
            { type: 'vacancy', id: 'v1', label: 'Verpleegkundige' },
          ],
        },
      ],
    }
    render(<KoiosMessage msg={msg} t={mockT} />)
    expect(screen.getByText('Kandidaten (1)')).toBeInTheDocument()
    expect(screen.getByText('Vacatures (1)')).toBeInTheDocument()
  })

  // FIND-1: search_all's buckets widened past the original five — a contact/task/
  // location ref groups into its own labelled card, never dropped.
  it('groups contact/task/location refs into their own English buckets', () => {
    const msg: KoiosChatMessage = {
      role: 'assistant',
      answer: 'Found some results',
      steps: [
        {
          tool: 'search_all',
          refs: [
            { type: 'contact', id: 'ct1', label: 'Fleur Smit', parent: { type: 'customer', id: 'cu1' } },
            { type: 'task', id: 'tk1', label: 'Bellen' },
            { type: 'location', id: 'lo1', label: 'Vestiging Zuid', parent: { type: 'customer', id: 'cu1' } },
          ],
        },
      ],
    }
    render(<KoiosMessage msg={msg} t={t} />)
    expect(screen.getByText(`${t('koios:results.group.contacts')} (1)`)).toBeInTheDocument()
    expect(screen.getByText(`${t('koios:results.group.tasks')} (1)`)).toBeInTheDocument()
    expect(screen.getByText(`${t('koios:results.group.locations')} (1)`)).toBeInTheDocument()
  })

  // FIND-1: a Dutch dual-key bucket (contactpersonen/taken/locaties, phase-B window)
  // groups identically to the English key.
  it('groups Dutch dual-key buckets the same as English ones', () => {
    const msg: KoiosChatMessage = {
      role: 'assistant',
      answer: 'Found some results',
      steps: [
        {
          tool: 'search_all',
          result: { 'contactpersonen': { count: 1 } },
          refs: [{ type: 'contact', id: 'ct1', label: 'Fleur Smit', parent: { type: 'customer', id: 'cu1' } }],
        } as unknown as Record<string, unknown>,
      ],
    }
    render(<KoiosMessage msg={msg} t={t} />)
    expect(screen.getByText(`${t('koios:results.group.contacts')} (1)`)).toBeInTheDocument()
  })

  // FIND-1: a bucket type this FE has never mapped keeps its own group instead
  // of being silently dropped — falls back to the raw type as its label.
  it('keeps an unknown bucket type as its own group', () => {
    const msg: KoiosChatMessage = {
      role: 'assistant',
      answer: 'Found some results',
      steps: [
        { tool: 'search_all', refs: [{ type: 'reference', id: 'rf1', label: 'Some reference' }] },
      ],
    }
    render(<KoiosMessage msg={msg} t={t} />)
    expect(screen.getByText('reference (1)')).toBeInTheDocument()
  })
})
