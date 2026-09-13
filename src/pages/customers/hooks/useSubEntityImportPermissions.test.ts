import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import * as authModule from '@/context/AuthContext'
import { useSubEntityImportPermissions } from './useSubEntityImportPermissions'

vi.mock('@/context/AuthContext')

// Shared import-affordance gate (AddDepartmentModal, AddLocationModal): both
// checks read the `customers.*` permissions, since importing IS creating (§4).
describe('useSubEntityImportPermissions', () => {
  it('reads canViewImportTemplate from customers.view and canRunImport from customers.create', () => {
    const hasPermission = vi.fn((perm: string) => perm === 'customers.view')
    vi.mocked(authModule.useAuth).mockReturnValue({ hasPermission } as unknown as ReturnType<typeof authModule.useAuth>)

    const { result } = renderHook(() => useSubEntityImportPermissions())

    expect(result.current.canViewImportTemplate).toBe(true)
    expect(result.current.canRunImport).toBe(false)
  })

  it('falls back to false on both when the auth context is absent', () => {
    vi.mocked(authModule.useAuth).mockReturnValue(null)

    const { result } = renderHook(() => useSubEntityImportPermissions())

    expect(result.current.canViewImportTemplate).toBe(false)
    expect(result.current.canRunImport).toBe(false)
  })
})
