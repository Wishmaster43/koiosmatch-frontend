/**
 * AddVacancyModal — covers the house "wide form" adoption (Danny 27-07: "+
 * vacature is niet zo groot als + Match / + nieuwe kandidaat en geen mooie
 * kaders en zoekbare dropdown"): the card regroup (Algemeen/Plaatsing/
 * Publicatie), every dropdown (client/industry/category/status/owner) becoming
 * a searchable CreatableSelect that actually filters by typing, the title
 * validation still blocking an incomplete submit, and the exact same POST body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ statuses: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] }),
}))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'] }) }))

const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

const users = [{ id: 'u1', name: 'Piet Recruiter' }]
const customers = [{ id: 'c1', name: 'Rivas Zorggroep' }, { id: 'c2', name: 'Yesway Zorg' }]
const noop = () => {}

beforeEach(() => {
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { data: { id: 'v-new', title: 'Verpleegkundige' } } })
})

describe('AddVacancyModal · titled cards (Danny 27-07 house frame)', () => {
  it('groups the fields into Algemeen / Plaatsing / Publicatie cards', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByText('modal.fields.cardGeneral')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardPlacement')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardPublication')).toBeInTheDocument()
  })
})

describe('AddVacancyModal · validation', () => {
  it('blocks submit while the title is empty', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    const createBtn = screen.getByRole('button', { name: 'modal.create' })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('AddVacancyModal · searchable client picker', () => {
  it('typing narrows the option list, then picking updates the trigger', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    // Trigger's name is now the field label (aria-labelledby self-reference drops
    // its own visible text), not the shared "common:select" placeholder text —
    // so the client trigger is found by its own stable label, no more index
    // needed to tell it apart from Plaatsing/Publicatie's owner picker.
    await user.click(screen.getByRole('button', { name: 'modal.fields.client' }))
    await user.type(screen.getByPlaceholderText('common:select'), 'Yesway')
    expect(screen.getByRole('button', { name: 'Yesway Zorg' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rivas Zorggroep' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yesway Zorg' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: 'modal.fields.client' })).toHaveTextContent('Yesway Zorg')
  })
})

describe('AddVacancyModal · submit body unchanged by the card regroup', () => {
  it('POSTs the exact same body once the title is filled', async () => {
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} onCreated={onCreated} users={users} customers={customers} />)

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Verpleegkundige')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    expect(mockPost).toHaveBeenCalledWith('/vacancies', {
      title: 'Verpleegkundige', status: 'open', owner_id: null, customer_id: null,
      industry: null, category: null, location: null,
    })
  })
})
