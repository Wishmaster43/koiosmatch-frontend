/**
 * ChangelogTab · V8 (VACATURES-100) — the rewrite onto the CHANGELOG-3 shape
 * (per-field diff cards, old → new, date-range filter, search). Regression guard
 * for the bug this rewrite fixed: the previous version rendered the flat Spatie
 * `description`/`log_name` string and ignored the `changes` diff bag the backend
 * already sends (EntityChangelogController shares LogsEntityActivity with
 * candidates) — a vacancy field edit showed a generic "Bijgewerkt" line with no
 * old/new values at all.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChangelogTab from './ChangelogTab'
import nlVacancies from '@/i18n/locales/nl/vacancies.json'
import type { VacancyDetail } from '@/types/vacancy'

vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({
    statusMeta: (v: string) => ({ label: v === 's1' ? 'Open' : 'Gesloten' }),
    seniorityMeta: () => ({ label: '' }),
    educationMeta: () => ({ label: '' }),
  }),
}))
// V30: the AI-agent name resolution needs no live query in this test — a
// mutable source list so the resolution test below can seed a named agent.
let mockAgents: Array<{ id: string; name: string }> = []
vi.mock('../hooks/useAiAgents', () => ({
  useAiAgents: () => ({ agents: mockAgents, options: [], loading: false, error: false }),
}))

// A `let`, not `const` — the empty-state test below reassigns it, and the mocked
// hook reads it fresh on every render (module-level mocks can't be re-scoped per
// test with vi.mock's hoisted factory, so a mutable source list is the simplest fix).
let mockItems: Array<Record<string, unknown>> = [
  {
    id: 'a1', event: 'updated', description: 'updated', causer_name: 'Danny Polak', created_at: '2026-07-10T09:00:00Z',
    changes: {
      attributes: { title: 'Verpleegkundige IC', vacancy_status_id: 's1' },
      old: { title: 'Verpleegkundige', vacancy_status_id: 's2' },
    },
  },
]
vi.mock('../hooks/useVacancyActivity', () => ({
  useVacancyActivity: () => ({ items: mockItems, loading: false, error: false }),
}))

const vacancy = { id: 'v1', title: 'Verpleegkundige IC' } as VacancyDetail

describe('ChangelogTab · per-field diff cards (CHANGELOG-3 shape)', () => {
  it('renders one card per changed field with old → new values and the resolved lookup label', () => {
    render(<ChangelogTab vacancy={vacancy} bare />)

    // The title diff shows the raw old/new strings.
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige IC')).toBeInTheDocument()

    // The status diff resolves the lookup id to its tenant label, not the raw uuid.
    expect(screen.getByText('Gesloten')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()

    // The causer + humanized action line is shown once per field-diff card.
    expect(screen.getAllByText(/Danny Polak/).length).toBe(2)
  })

  it('shows the calm empty state when there are no changes', () => {
    mockItems = []
    render(<ChangelogTab vacancy={vacancy} bare />)
    // No changes → the empty state, never a blank screen (§3 four UI states).
    expect(screen.getByText(nlVacancies.changelog.empty)).toBeInTheDocument()
  })
})

// ACTORLABEL-SWEEP-1: actor_label ("<name>-KoiosAI") wins over causer_name when present.
describe('ChangelogTab · actor_label precedence', () => {
  it('shows actor_label instead of causer_name when both are present', () => {
    mockItems = [
      { id: 'a3', event: 'updated', description: 'updated', causer_name: 'Danny Polak', actor_label: 'Danny Polak-KoiosAI', created_at: '2026-08-20T09:00:00Z',
        changes: { attributes: { title: 'New title' }, old: { title: 'Old title' } } },
    ]
    render(<ChangelogTab vacancy={vacancy} bare />)
    expect(screen.getByText(/Danny Polak-KoiosAI/)).toBeInTheDocument()
    expect(screen.queryByText(/Danny Polak(?!-KoiosAI)/)).toBeNull()
  })

  it('falls back to causer_name when actor_label is absent', () => {
    mockItems = [
      { id: 'a4', event: 'updated', description: 'updated', causer_name: 'Danny Polak', created_at: '2026-08-20T09:00:00Z',
        changes: { attributes: { title: 'New title' }, old: { title: 'Old title' } } },
    ]
    render(<ChangelogTab vacancy={vacancy} bare />)
    expect(screen.getByText(/Danny Polak/)).toBeInTheDocument()
  })
})

// V30: Danny's exact complaint — "ai agent id — bijgewerkt" told nobody WHICH
// agent changed. The diff now resolves ai_agent_id against the tenant's agents.
describe('ChangelogTab · V30 AI-agent name resolution', () => {
  it('shows the resolved agent name instead of the raw uuid', () => {
    mockItems = [
      { id: 'a2', event: 'updated', description: 'updated', causer_name: 'Danny Polak', created_at: '2026-08-14T09:00:00Z',
        changes: { attributes: { ai_agent_id: 'agent-1' }, old: { ai_agent_id: null } } },
    ]
    mockAgents = [{ id: 'agent-1', name: 'Intake bot' }]
    render(<ChangelogTab vacancy={vacancy} bare />)
    expect(screen.getByText('Intake bot')).toBeInTheDocument()
    expect(screen.queryByText('agent-1')).toBeNull()
  })
})
