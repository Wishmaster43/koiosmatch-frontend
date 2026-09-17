/**
 * useAppointmentTypes — audience split (rows 2/102, CONTRACT-CHANGELOG
 * "appointment types split by audience"): the hook must request the
 * `?audience=candidate|contact` param whenever a caller names its subject, and
 * stay unfiltered when it doesn't (mirrors the existing candidate/contact list
 * both being served from the same endpoint).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAppointmentTypes } from './useAppointmentTypes'

vi.mock('./api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})) }, // never resolves — only the request shape is asserted
  getActiveTenantId: vi.fn(() => null),
  unwrapList: (res: unknown) => res,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
import api from './api'
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useAppointmentTypes audience param', () => {
  it('requests ?audience=candidate for a candidate-scoped caller', async () => {
    renderHook(() => useAppointmentTypes('candidate'))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/appointment-types?active=1&audience=candidate', undefined))
  })

  it('requests ?audience=contact for a contact-scoped caller', async () => {
    renderHook(() => useAppointmentTypes('contact'))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/appointment-types?active=1&audience=contact', undefined))
  })

  it('stays unfiltered when no audience is given', async () => {
    renderHook(() => useAppointmentTypes())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/appointment-types?active=1', undefined))
  })
})
