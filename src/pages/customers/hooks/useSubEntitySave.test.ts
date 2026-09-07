/**
 * Test useSubEntitySave hook: field error mapping, import wizard effect, state management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useSubEntitySave } from './useSubEntitySave'

// Mock useImportWizard
vi.mock('@/pages/settings/shared', () => ({
  useImportWizard: vi.fn(() => ({
    file: null,
    run: { status: 'idle', result: { summary: { create: 0, update: 0 } } },
  })),
}))

// Mock extractApiError
vi.mock('@/lib/extractApiError', () => ({
  extractApiError: vi.fn((_err, fallback) => fallback),
}))

const mockT = vi.fn((key: string) => key) as unknown as TFunction

const API_TO_FORM = {
  first_name: 'firstName',
  email_address: 'email',
}

describe('useSubEntitySave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with edit/import state', () => {
    const { result } = renderHook(() => useSubEntitySave({
      initial: null,
      apiToFormMap: API_TO_FORM,
      t: mockT,
      onImported: vi.fn(),
      onClose: vi.fn(),
      importEntity: 'departments',
    }))

    expect(result.current.isEdit).toBe(false)
    expect(result.current.importOpen).toBe(false)
    expect(result.current.errors).toEqual({})
    expect(result.current.createError).toBeNull()
  })

  it('maps API 422 field errors back to form fields', () => {
    const { result } = renderHook(() => useSubEntitySave({
      initial: null,
      apiToFormMap: API_TO_FORM,
      t: mockT,
      onImported: vi.fn(),
      onClose: vi.fn(),
      importEntity: 'departments',
    }))

    const mockError = {
      response: {
        data: {
          errors: {
            first_name: ['Name is required'],
            email_address: ['Invalid email'],
          },
        },
      },
    }

    act(() => {
      result.current.handleApiError(mockError)
    })

    expect(result.current.errors).toEqual({
      firstName: true,
      email: true,
    })
  })

  it('handles unmapped 422 fields by passthrough', () => {
    const { result } = renderHook(() => useSubEntitySave({
      initial: null,
      apiToFormMap: API_TO_FORM,
      t: mockT,
      onImported: vi.fn(),
      onClose: vi.fn(),
      importEntity: 'departments',
    }))

    const mockError = {
      response: {
        data: {
          errors: {
            custom_field: ['Error message'],
          },
        },
      },
    }

    act(() => {
      result.current.handleApiError(mockError)
    })

    expect(result.current.errors).toEqual({ custom_field: true })
  })

  it('extracts generic error message when no field errors', () => {
    const { result } = renderHook(() => useSubEntitySave({
      initial: null,
      apiToFormMap: API_TO_FORM,
      t: mockT,
      onImported: vi.fn(),
      onClose: vi.fn(),
      importEntity: 'departments',
    }))

    const mockError = {
      response: {
        data: {
          message: 'Something went wrong',
        },
      },
    }

    act(() => {
      result.current.handleApiError(mockError)
    })

    expect(result.current.createError).toBe('common:errorGeneric')
  })

  it('toggles import panel open/closed', () => {
    const { result } = renderHook(() => useSubEntitySave({
      initial: null,
      apiToFormMap: API_TO_FORM,
      t: mockT,
      onImported: vi.fn(),
      onClose: vi.fn(),
      importEntity: 'departments',
    }))

    expect(result.current.importOpen).toBe(false)

    act(() => {
      result.current.setImportOpen(true)
    })

    expect(result.current.importOpen).toBe(true)

    act(() => {
      result.current.setImportOpen(false)
    })

    expect(result.current.importOpen).toBe(false)
  })
})
