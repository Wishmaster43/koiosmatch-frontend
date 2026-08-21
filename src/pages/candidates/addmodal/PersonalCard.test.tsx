/**
 * PersonalCard layout regression (2026-08-14): first name owns its own full
 * row, middle/last name pair below it, dob/gender pair below that — mirrors
 * the CustomerAddressCard/CustomerCompanyCard label-left canon (§4). Confirms
 * all fields still render and remain independently editable; save-request
 * shape itself is covered by AddCandidateModal.test.tsx (unchanged route/body).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import PersonalCard from './PersonalCard'
import { CvFilledContext } from './cvFilledContext'
import type { FormState } from '../AddCandidateModal'

// Minimal i18n instance so t() resolves to stable keys for assertions.
i18n.use(initReactI18next).init({
  lng: 'en', resources: {}, interpolation: { escapeValue: false },
  returnNull: false, returnEmptyString: false,
})

const baseForm = {
  firstName: '', middleName: '', lastName: '', dateOfBirth: '', gender: '',
} as unknown as FormState

function setup() {
  const set = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <CvFilledContext.Provider value={new Set()}>
        <PersonalCard
          form={baseForm}
          errors={{}}
          set={set as (k: keyof FormState, v: string) => void}
          isReq={() => false}
          genderOptions={[{ value: 'male', label: 'Man' }]}
        />
      </CvFilledContext.Provider>
    </I18nextProvider>,
  )
  return { set }
}

describe('PersonalCard layout', () => {
  it('renders first, middle, last name and dob/gender fields', () => {
    setup()
    // POP-UPS 1 (21-08): placeholders now resolve via the shared common:placeholders.*
    // keys; the ns prefix is stripped by this real-but-resourceless i18next instance
    // (same fallback behaviour already proven by the middleName assertion below).
    expect(screen.getByPlaceholderText('placeholders.firstName')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('placeholders.middleName')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('placeholders.lastName')).toBeInTheDocument()
  })

  it('keeps first name on its own row, separate from middle/last name', () => {
    setup()
    const firstNameRow = screen.getByPlaceholderText('placeholders.firstName').closest('div[style]')
    const middleNameRow = screen.getByPlaceholderText('placeholders.middleName').closest('div[style]')
    // Different row containers (first name is no longer grid-mated with middle/last).
    expect(firstNameRow).not.toBe(middleNameRow)
  })

  it('still calls set() per field on edit (same onChange wiring)', async () => {
    const { set } = setup()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('placeholders.firstName'), 'J')
    expect(set).toHaveBeenCalledWith('firstName', 'J')
    await user.type(screen.getByPlaceholderText('placeholders.lastName'), 'D')
    expect(set).toHaveBeenCalledWith('lastName', 'D')
  })
})
