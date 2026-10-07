/**
 * Test useSubEntitySave hook: field error mapping, import wizard effect, state management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TFunction } from 'i18next'
import * as authModule from '@/context/AuthContext'
import { useSubEntitySave } from './useSubEntitySave'

vi.mock('@/context/AuthContext')

// Mock useImportWizard
vi.mock('@/pages/settings/shared', () => ({
  useImportWizard: vi.fn(() => ({
    file: null,
    run: { status: 'idle', result: { summary: { create: 0, update: 0 } } },
  })),
}))

// Mock extractApiError — keeps the real RAW_REQUIRED_RE (formatUnmappedErrors imports it).
vi.mock('@/lib/extractApiError', () => ({
  extractApiError: vi.fn((_err, fallback) => fallback),
  RAW_REQUIRED_RE: /^The .+ field is required\.$/,
}))

const mockT = vi.fn((key: string) => key) as unknown as TFunction

const API_TO_FORM = {
  first_name: 'firstName',
  email_address: 'email',
}

describe('useSubEntitySave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const hasPermission = vi.fn((perm: string) => perm === 'customers.view' || perm === 'customers.create')
    vi.mocked(authModule.useAuth).mockReturnValue({ hasPermission } as unknown as ReturnType<typeof authModule.useAuth>)
  })

  // DRY-11: the import permissions gate rides along with the hook that already
  // gates the import wizard it belongs to — one combined call, not two siblings.
  it('surfaces the import-affordance gate alongside the import wizard', () => {
    const { result } = renderHook(() => useSubEntitySave({
      initial: null,
      apiToFormMap: API_TO_FORM,
      t: mockT,
      onImported: vi.fn(),
      onClose: vi.fn(),
      importEntity: 'departments',
    }))

    expect(result.current.canViewImportTemplate).toBe(true)
    expect(result.current.canRunImport).toBe(true)
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

  it('ONIX N-005: surfaces an unmapped dotted 422 key as a banner alongside the field flags', () => {
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
            'custom_fields.vog': ['The custom_fields.vog field is required.'],
          },
        },
      },
    }

    act(() => {
      result.current.handleApiError(mockError)
    })

    expect(result.current.errors).toEqual({ firstName: true, 'custom_fields.vog': true })
    expect(result.current.createError).toBe('common:validation.fieldRequiredNamed')
  })

  it('ONIX N-005: a renderedKeys match keeps the dotted key out of the banner', () => {
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
            'custom_fields.vog': ['Required'],
          },
        },
      },
    }

    act(() => {
      result.current.handleApiError(mockError, ['custom_fields.vog'])
    })

    expect(result.current.errors).toEqual({ firstName: true, 'custom_fields.vog': true })
    expect(result.current.createError).toBeNull()
  })

  it('ONIX N-005 (POLISH): keeps the server message under its dotted custom-fields key', () => {
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
            'custom_fields.vog': ['Only digits'],
          },
        },
      },
    }

    act(() => {
      result.current.handleApiError(mockError, ['custom_fields.vog'])
    })

    expect(result.current.fieldMessages).toEqual({ 'custom_fields.vog': 'Only digits' })

    // A later reset (e.g. a fresh submit) clears both the flags and the messages together.
    act(() => {
      result.current.setErrors({})
      result.current.setFieldMessages({})
    })

    expect(result.current.errors).toEqual({})
    expect(result.current.fieldMessages).toEqual({})
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
