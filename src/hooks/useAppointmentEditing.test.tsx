/**
 * useAppointmentEditing — shared appointment editing state.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppointmentEditing } from './useAppointmentEditing'
import type { ExistingAppointment } from '@/pages/candidates/shared'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'
import type { Id } from '@/types/common'

describe('useAppointmentEditing', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient()
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }
  }

  it('initializes with null editing state', () => {
    const { result } = renderHook(
      () => useAppointmentEditing({
        queryKey: ['test', 'appointments'],
      }),
      { wrapper: createWrapper() }
    )
    expect(result.current.editing).toBeNull()
  })

  it('sets editing state', () => {
    const { result } = renderHook(
      () => useAppointmentEditing({
        queryKey: ['test', 'appointments'],
      }),
      { wrapper: createWrapper() }
    )
    const editingState = { candidateId: '123' as Id, appt: { id: '456' } as ExistingAppointment }
    act(() => {
      result.current.setEditing(editingState)
    })
    expect(result.current.editing).toEqual(editingState)
  })

  it('clears editing state when set to null', () => {
    const { result } = renderHook(
      () => useAppointmentEditing({
        queryKey: ['test', 'appointments'],
      }),
      { wrapper: createWrapper() }
    )
    const editingState = { candidateId: '123' as Id, appt: { id: '456' } as ExistingAppointment }
    act(() => {
      result.current.setEditing(editingState)
    })
    act(() => {
      result.current.setEditing(null)
    })
    expect(result.current.editing).toBeNull()
  })

  it('reload invalidates the queries cached under the given queryKey', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const { result } = renderHook(
      () => useAppointmentEditing({ queryKey: ['test', 'appointments'] }),
      { wrapper: Wrapper }
    )
    act(() => {
      result.current.reload()
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['test', 'appointments'] })
  })

  it('toExisting maps a VacancyAppointmentRow to the ExistingAppointment shape and merges extra fields', () => {
    const { result } = renderHook(
      () => useAppointmentEditing({
        queryKey: ['test', 'appointments'],
        extra: { vacancy_id: '999' as Id },
      }),
      { wrapper: createWrapper() }
    )
    const row: VacancyAppointmentRow = {
      id: '456' as Id,
      candidateId: null,
      candidateName: null,
      applicationId: null,
      customerId: null,
      customerName: null,
      customerLocationId: null,
      customerLocationName: null,
      customerDepartmentId: null,
      customerDepartmentName: null,
      contactId: null,
      contactName: null,
      type: 'intake',
      scheduledAt: '2026-09-10T10:00:00Z',
      durationMin: 30,
      modality: 'in_person',
      appointmentLocation: 'HQ',
      ownerId: '789' as Id,
      ownerName: null,
      locationId: '1' as Id,
      locationName: null,
      status: null,
      isOverdue: false,
      source: null,
      outcome: null,
      notes: null,
      meetingUrl: null,
    }
    const existing = result.current.toExisting(row)
    expect(existing).toEqual({
      id: '456',
      scheduled_at: '2026-09-10T10:00:00Z',
      duration_min: 30,
      modality: 'in_person',
      owner_id: '789',
      type: 'intake',
      location_id: '1',
      appointment_location: 'HQ',
      vacancy_id: '999',
    })
  })
})
