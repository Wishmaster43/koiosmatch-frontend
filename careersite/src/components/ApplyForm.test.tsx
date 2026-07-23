import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApplyForm } from './ApplyForm'
import { strings } from '../strings'
import * as api from '../api'
import type { ApplicationSettings } from '../types'

// Only the network call is mocked — the consent-gate/validation logic runs for real,
// so this test proves the actual REQUEST is (or isn't) made, not just that a callback fired.
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return { ...actual, applyToVacancy: vi.fn() }
})

const mockedApply = vi.mocked(api.applyToVacancy)

// Baseline settings mirror the pre-formulier-v2 form shape (photo/remarks/interview
// consent off) so the original consent-gate/motivation tests keep asserting a single
// checkbox — tests that exercise the new fields override the relevant key.
const BASE_SETTINGS: ApplicationSettings = {
  cv: 'optional',
  cover_letter: 'optional',
  photo: 'hidden',
  remarks: 'hidden',
  interview_consent: 'hidden',
}

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
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={BASE_SETTINGS} />)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(mockedApply).not.toHaveBeenCalled()
    expect(await screen.findByText(strings.apply.validation.consent)).toBeTruthy()
  })

  it('submits a request with an empty honeypot once required fields + consent are given', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={BASE_SETTINGS} />)
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
    // Default country is NL (+31) — verbatim join with the typed local number.
    expect(payload.phone).toBe('+310612345678')
  })

  // Danny 23-07: motivation moved from a plain textarea to the rich-text editor —
  // this proves the submitted payload carries the editor's HTML, not plain text.
  it('submits the rich-text motivation as HTML', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={BASE_SETTINGS} />)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox'))

    const editor = screen.getByRole('textbox', { name: strings.apply.motivation })
    editor.innerHTML = '<p><strong>Zeer</strong> gemotiveerd</p>'
    fireEvent.input(editor)

    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(await screen.findByText(strings.apply.success('APP-1'))).toBeTruthy()
    const [, , payload] = mockedApply.mock.calls[0]
    expect(payload.motivation).toBe('<p><strong>Zeer</strong> gemotiveerd</p>')
  })

  // The 5000-char BE limit is checked on the TEXT content, not the HTML markup — a long
  // plain-text motivation must still block submission even though our own tags are short.
  it('blocks submission when the motivation text exceeds 5000 characters', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={BASE_SETTINGS} />)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox'))

    const editor = screen.getByRole('textbox', { name: strings.apply.motivation })
    editor.innerHTML = `<p>${'a'.repeat(5001)}</p>`
    fireEvent.input(editor)

    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(await screen.findByText(strings.apply.validation.motivationLength)).toBeTruthy()
    expect(mockedApply).not.toHaveBeenCalled()
  })
})

describe('ApplyForm — settings-driven field visibility (formulier-v2)', () => {
  it('does not render a photo input when the vacancy setting is hidden (the default)', () => {
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={BASE_SETTINGS} />)
    expect(screen.queryByLabelText(strings.apply.photo.label)).toBeNull()
  })

  it('blocks submission when CV is required by the vacancy and no file was chosen', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={{ ...BASE_SETTINGS, cv: 'required' }} />)
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(mockedApply).not.toHaveBeenCalled()
    expect(await screen.findByText(strings.apply.validation.required)).toBeTruthy()
  })

  // Hidden means gone from the DOM AND never reaching the payload — proven together
  // since the payload is exactly what would be handed to buildApplyFormData (api.test.ts
  // covers that a falsy `motivation` is never appended to the multipart body).
  it('hides the motivation field and never sends it when cover_letter is hidden', async () => {
    const user = userEvent.setup()
    render(
      <ApplyForm tenant="acme" reference="REF-1" applicationSettings={{ ...BASE_SETTINGS, cover_letter: 'hidden' }} />,
    )
    expect(screen.queryByRole('textbox', { name: strings.apply.motivation })).toBeNull()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(await screen.findByText(strings.apply.success('APP-1'))).toBeTruthy()
    const [, , payload] = mockedApply.mock.calls[0]
    expect(payload.motivation).toBeUndefined()
  })

  it('blocks submission when interview consent is required and left unchecked', async () => {
    const user = userEvent.setup()
    render(
      <ApplyForm
        tenant="acme"
        reference="REF-1"
        applicationSettings={{ ...BASE_SETTINGS, interview_consent: 'required' }}
      />,
    )
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: strings.apply.consentLabel }))
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(mockedApply).not.toHaveBeenCalled()
    expect(await screen.findByText(strings.apply.validation.interviewConsentRequired)).toBeTruthy()
  })
})

describe('ApplyForm — photo client validation', () => {
  it('rejects an oversized photo file client-side without ever calling the API', async () => {
    const user = userEvent.setup()
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={{ ...BASE_SETTINGS, photo: 'optional' }} />)
    const bigFile = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'photo.jpg', { type: 'image/jpeg' })

    await user.upload(screen.getByLabelText(strings.apply.photo.label), bigFile)

    expect(await screen.findByText(strings.apply.validation.photoFileSize)).toBeTruthy()
    expect(mockedApply).not.toHaveBeenCalled()
  })

  it('rejects a wrong-type photo file client-side', async () => {
    render(<ApplyForm tenant="acme" reference="REF-1" applicationSettings={{ ...BASE_SETTINGS, photo: 'optional' }} />)
    const badFile = new File(['data'], 'photo.gif', { type: 'image/gif' })
    const input = screen.getByLabelText(strings.apply.photo.label)
    // userEvent.upload enforces the input's `accept` attribute and silently drops a
    // non-matching file — fireEvent bypasses that so the client validation itself
    // (not the browser's file picker) is what's under test here.
    fireEvent.change(input, { target: { files: [badFile] } })

    expect(await screen.findByText(strings.apply.validation.photoFileType)).toBeTruthy()
    expect(mockedApply).not.toHaveBeenCalled()
  })
})

describe('ApplyForm — payload assembly (address, remarks, phone, repeatable entries)', () => {
  it('joins the selected country dial code and carries address/remarks/experience/education into the payload', async () => {
    const user = userEvent.setup()
    render(
      <ApplyForm tenant="acme" reference="REF-1" applicationSettings={{ ...BASE_SETTINGS, remarks: 'optional' }} />,
    )
    await fillRequiredFields(user)
    await user.selectOptions(screen.getByLabelText(strings.apply.phoneCountryCodeLabel), 'BE')
    await user.type(screen.getByLabelText(strings.apply.address.street), 'Kerkstraat')
    await user.type(screen.getByLabelText(strings.apply.address.houseNumber), '12')
    await user.type(screen.getByLabelText(strings.apply.address.postcode), '1234AB')
    await user.type(screen.getByLabelText(strings.apply.address.city), 'Utrecht')
    await user.type(screen.getByLabelText(strings.apply.remarks.label), 'Een vraag over de vacature')

    await user.click(screen.getByRole('button', { name: strings.apply.experience.addButton }))
    await user.type(screen.getByLabelText(strings.apply.experience.company), 'Acme Zorg')
    await user.click(screen.getByRole('button', { name: strings.apply.experience.saveButton }))

    await user.click(screen.getByRole('button', { name: strings.apply.education.addButton }))
    await user.type(screen.getByLabelText(strings.apply.education.name), 'Verpleegkunde diploma')
    await user.click(screen.getByRole('button', { name: strings.apply.education.saveButton }))

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: strings.apply.submit }))

    expect(await screen.findByText(strings.apply.success('APP-1'))).toBeTruthy()
    const [, , payload] = mockedApply.mock.calls[0]
    expect(payload.phone).toBe('+320612345678')
    expect(payload.street).toBe('Kerkstraat')
    expect(payload.house_number).toBe('12')
    expect(payload.postcode).toBe('1234AB')
    expect(payload.city).toBe('Utrecht')
    expect(payload.remarks).toBe('Een vraag over de vacature')
    expect(payload.experiences).toEqual([
      { company: 'Acme Zorg', title: '', location: '', start_date: '', end_date: '', responsibilities: '', achievements: '' },
    ])
    expect(payload.educations).toEqual([
      { name: 'Verpleegkunde diploma', organisation: '', issued_at: '', license_number: '' },
    ])
  })
})
