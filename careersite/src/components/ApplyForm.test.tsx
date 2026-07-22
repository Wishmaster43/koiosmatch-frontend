import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApplyForm } from './ApplyForm'
import { strings } from '../strings'
import * as api from '../api'

// Only the network call is mocked — the consent-gate/validation logic runs for real,
// so this test proves the actual REQUEST is (or isn't) made, not just that a callback fired.
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return { ...actual, applyToVacancy: vi.fn() }
})

const mockedApply = vi.mocked(api.applyToVacancy)

beforeEach(() => {
  mockedApply.mockReset()
  mockedApply.mockResolvedValue({ status: 'applied', reference: 'APP-1' })
})

// Fills the four required contact fields; consent/CV are each test's own concern.
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(strings.apply.firstName), 'Jane')
  await user.type(screen.getByLabelText(strings.apply.lastName), 'Doe')
  await user.type(screen.getByLabelText(strings.apply.email), 'jane@example.com')
  await user.type(screen.getByLabelText(strings.apply.phone), '0612345678')
}

describe('ApplyForm — consent gate + honeypot', () => {
  it('blocks the apply request when the AVG consent checkbox is not checked', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" />)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(mockedApply).not.toHaveBeenCalled()
    expect(await screen.findByText(strings.apply.validation.consent)).toBeTruthy()
  })

  it('submits a request with an empty honeypot once required fields + consent are given', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" />)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(await screen.findByText(strings.apply.success('APP-1'))).toBeTruthy()
    expect(mockedApply).toHaveBeenCalledTimes(1)
    const [tenant, reference, payload] = mockedApply.mock.calls[0]
    expect(tenant).toBe('acme')
    expect(reference).toBe('REF-1')
    expect(payload.website).toBe('')
    expect(payload.first_name).toBe('Jane')
    expect(payload.email).toBe('jane@example.com')
  })
})
