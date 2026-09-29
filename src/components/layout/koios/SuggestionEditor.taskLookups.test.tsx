/**
 * SuggestionEditor — regression for the real TaskLookupsContext (TASK-CREATE-EDIT-1
 * verifier fix): the Koios panel mounts app-wide (DashboardLayout), with no
 * TaskLookupsProvider above it, so a create_task editor must supply its own scope
 * rather than assume a page-scoped one. This test does NOT mock
 * `@/context/TaskLookupsContext` — only `@/lib/api`, so the provider's own fetch
 * effect runs for real.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SuggestionEditor from './SuggestionEditor'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Never a live AI/API call (API-CREDITS-1): the priority lookup resolves from a
// fixture, mirroring the tenant `/task-priorities` shape.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: {
    get: (url: string) => {
      if (url === '/task-priorities') {
        // Fixture colours use design tokens (mirroring SuggestionEditor.test.tsx's own
        // fixture), never raw hex, so the file needs no HUISSTIJL-ceiling disable.
        return Promise.resolve({ data: { data: [
          { value: 'low', label: 'Laag', color: 'var(--color-info)', is_default: false },
          { value: 'normal', label: 'Normaal', color: 'var(--color-primary)', is_default: true },
          { value: 'high', label: 'Hoog', color: 'var(--text-muted)', is_default: false },
        ] } })
      }
      return Promise.reject(new Error(`unexpected url ${url}`))
    },
  },
}))

const createTaskAction = { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen Timmermans' } }

describe('SuggestionEditor · real TaskLookupsContext', () => {
  it('renders without a page-level provider and seeds a non-empty tenant default priority', async () => {
    render(<SuggestionEditor action={createTaskAction} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    // The picker's placeholder ("koios.pendingAction.fields.priority") only shows while
    // empty — once the fetched lookup seeds the default, that placeholder text disappears,
    // proving the real provider's fetch effect resolved without throwing.
    await screen.findByDisplayValue('Bel Koen Timmermans')
    // The seed-translation key proves the real fetch resolved and the default priority
    // seeded (LOOKUP-I18N-1 renders the seeded label through its own translation key,
    // "normal" here, while a raw t()-mock only echoes keys back verbatim). ROLE-PICKER-LEFT-1:
    // the trigger's accessible NAME stays its label; the current value is the visible span.
    await waitFor(() => {
      expect(screen.getByText('lookupSeeds.taskPriorities.normal')).toBeInTheDocument()
    })
  })
})
