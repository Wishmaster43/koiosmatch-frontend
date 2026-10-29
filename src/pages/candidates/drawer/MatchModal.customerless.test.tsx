/**
 * MatchModal — customer-less contract form DOM coverage (MATCH-KLANTLOOS-1). A
 * dedicated lightweight harness (own candidateTypes mock, unlike the shared
 * MatchModal.test.tsx which mocks an empty list) proving the visible surface:
 * picking a flagged Contractvorm hides Customer/Location/Department/Contact person,
 * disables submit until Vestiging is filled, and switching back restores the
 * fields. The exact POST-body seam (which keys ride/don't ride) is covered at
 * the hook level in useMatchForm.customerless.test.ts — this file only proves the
 * DOM the recruiter actually sees.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchModal from './MatchModal'

const CANDIDATE_TYPES = [
  { value: 'zzp', label: 'ZZP', color: 'var(--color-primary)', customer_not_applicable: true },
  { value: 'temp_agency', label: 'Uitzend', color: 'var(--text-muted)', customer_not_applicable: false },
]

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: CANDIDATE_TYPES }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/hooks/useCustomerOptions', () => ({
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

// `@/lib/datetime` would bootstrap the REAL i18n (poisoning t() into real Dutch);
// mocking it keeps t() returning raw keys, so selectors below use keys, not copy
// (same mock as MatchModal.test.tsx).
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }),
  useLocale: () => 'nl-NL',
  toLocalIsoDate: () => '',
  humanizeIsoDates: (s: string) => s,
  formatDateOnly: (s: string) => s,
  formatDateTimeStr: (s: string) => s,
  ddmmyyyy: () => '',
  hhmm: () => '',
  hhmmss: () => '',
  formatMonthYear: () => '',
}))
// Each trigger's accessible name is "<field label> <placeholder>" (aria-labelledby
// concatenates the external label span with the button's own placeholder span) —
// match the placeholder tail only, mirroring MatchModal.test.tsx's own regex idiom.
const pickerBtn = (placeholder: string) => screen.getByRole('button', { name: new RegExp(`${placeholder}$`) })
const queryPickerBtn = (placeholder: string) => screen.queryByRole('button', { name: new RegExp(`${placeholder}$`) })

describe('MatchModal · customer-less contract form DOM (MATCH-KLANTLOOS-1)', () => {
  it('hides Klant/Locatie/Afdeling/Contactpersoon once a flagged Contractvorm is picked, and restores them on switch-back', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={vi.fn()} onCreated={vi.fn()} />)

    // Unflagged by default: the customer field is visible.
    expect(pickerBtn('placement.pickCustomer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ZZP', pressed: false }))

    await waitFor(() => expect(queryPickerBtn('placement.pickCustomer')).not.toBeInTheDocument())
    expect(queryPickerBtn('placement.pickLocation')).not.toBeInTheDocument()
    expect(queryPickerBtn('placement.pickContact')).not.toBeInTheDocument()
    expect(screen.queryByText('placement.department')).not.toBeInTheDocument()

    // Switch back to an unflagged form — the fields return.
    await user.click(screen.getByRole('button', { name: 'Uitzend', pressed: false }))
    await waitFor(() => expect(pickerBtn('placement.pickCustomer')).toBeInTheDocument())
  })

  it('blocks submit with an empty branch, then POSTs branch_id with none of the four customer keys once filled', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.click(pickerBtn('placement.pickFunction'))
    await user.click(await screen.findByText('Verzorgende IG'))
    await user.click(screen.getByRole('button', { name: 'ZZP', pressed: false }))

    const saveBtn = await screen.findByRole('button', { name: 'placement.create' })
    expect(saveBtn).toBeDisabled()

    // The branch field now shows the REQUIRED placeholder (pickBranch), not the
    // plain "optional" one it carries when the form isn't klant-loos.
    await user.click(pickerBtn('placement.pickBranch'))
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
