/**
 * MatchModal — klant-loos Contractvorm DOM coverage (MATCH-KLANTLOOS-1). A
 * dedicated lightweight harness (own candidateTypes mock, unlike the shared
 * MatchModal.test.tsx which mocks an empty list) proving the visible surface:
 * picking a flagged Contractvorm hides Klant/Locatie/Afdeling/Contactpersoon,
 * disables submit until Vestiging is filled, and switching back restores the
 * fields. The exact POST-body seam (which keys ride/don't ride) is covered at
 * the hook level in useMatchForm.klantloos.test.ts — this file only proves the
 * DOM the recruiter actually sees.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchModal from './MatchModal'

const CANDIDATE_TYPES = [
  { value: 'zzp', label: 'ZZP', color: '#6E8FD6', customer_not_applicable: true },
  { value: 'temp_agency', label: 'Uitzend', color: '#9CA3AF', customer_not_applicable: false },
]

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: CANDIDATE_TYPES }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({
  useCustomerOptions: () => [{ value: 'cust-1', label: 'Zorggroep A' }],
}))
vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], functionOptions: ['Verzorgende IG'].map(n => ({ value: n, label: n })), allowFreeEntry: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [], options: [] }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [] }) }))
vi.mock('@/lib/useContactFunctions', () => ({ useContactFunctions: () => ({ contactFunctions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
vi.mock('@/pages/candidates/hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }), ActionRuleBanner: () => null }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// RichTextEditor's own Tiptap internals are out of scope (mirrors MatchModal.test.tsx).
vi.mock('@/components/ui/CollapsibleRichText', () => ({ default: () => null }))

const mockCustomer = { id: 'cust-1', name: 'Zorggroep A', branch_id: null, locations: [], contacts: [] }

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    return Promise.resolve({ data: { data: [] } })
  })
  return {
    ...actual,
    default: {
      get,
      post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })),
      patch: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  }
})

import api from '@/lib/api'

const apiPost = api.post as unknown as ReturnType<typeof vi.fn>

// `@/lib/datetime` (transitively imported by MatchModal) is NOT mocked here —
// its real bootstrap loads real i18n (mirrors the module-scope note in
// MatchModal.test.tsx), so pickers resolve their REAL nl translated placeholder
// text rather than a raw key; the selectors below use those Dutch strings.
// Each trigger's accessible name is "<field label> <placeholder>" (aria-labelledby
// concatenates the external label span with the button's own placeholder span) —
// match the placeholder tail only, mirroring MatchModal.test.tsx's own regex idiom.
const pickerBtn = (placeholder: string) => screen.getByRole('button', { name: new RegExp(`${placeholder}$`) })
const queryPickerBtn = (placeholder: string) => screen.queryByRole('button', { name: new RegExp(`${placeholder}$`) })

describe('MatchModal · klant-loos Contractvorm DOM (MATCH-KLANTLOOS-1)', () => {
  it('hides Klant/Locatie/Afdeling/Contactpersoon once a flagged Contractvorm is picked, and restores them on switch-back', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={vi.fn()} onCreated={vi.fn()} />)

    // Unflagged by default: the customer field is visible.
    expect(pickerBtn('Kies klant')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ZZP', pressed: false }))

    await waitFor(() => expect(queryPickerBtn('Kies klant')).not.toBeInTheDocument())
    expect(queryPickerBtn('Kies locatie')).not.toBeInTheDocument()
    expect(queryPickerBtn('Kies contactpersoon')).not.toBeInTheDocument()
    expect(screen.queryByText('Afdeling')).not.toBeInTheDocument()

    // Switch back to an unflagged form — the fields return.
    await user.click(screen.getByRole('button', { name: 'Uitzend', pressed: false }))
    await waitFor(() => expect(pickerBtn('Kies klant')).toBeInTheDocument())
  })

  it('blocks submit with an empty branch, then POSTs branch_id with none of the four customer keys once filled', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.click(pickerBtn('Kies functie'))
    await user.click(await screen.findByText('Verzorgende IG'))
    await user.click(screen.getByRole('button', { name: 'ZZP', pressed: false }))

    const saveBtn = await screen.findByRole('button', { name: 'Match aanmaken' })
    expect(saveBtn).toBeDisabled()

    // The branch field now shows the REQUIRED placeholder (pickBranch), not the
    // plain "optional" one it carries when the form isn't klant-loos.
    await user.click(pickerBtn('Kies vestiging'))
    await user.click(await screen.findByText('Vestiging Noord'))
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    await user.click(saveBtn)
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    const body = apiPost.mock.calls[0][1]
    expect(body.branch_id).toBe('branch-1')
    expect(body).not.toHaveProperty('customer_id')
    expect(body).not.toHaveProperty('customer_location_id')
    expect(body).not.toHaveProperty('customer_department_id')
    expect(body).not.toHaveProperty('contact_id')
  })
})
