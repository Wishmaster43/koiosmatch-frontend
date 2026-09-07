import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useOwnerDerivation } from './useOwnerDerivation'

describe('useOwnerDerivation', () => {
  it('derives owner from vacancy when available and assignable', () => {
    const { result } = renderHook(() => useOwnerDerivation({
      vacancyOwnerId: 'vacancy-owner-1',
      candidateOwnerId: 'candidate-owner-1',
      meId: 'me-1',
      userOptions: [
        { value: 'vacancy-owner-1', label: 'Vacancy Owner' },
        { value: 'candidate-owner-1', label: 'Candidate Owner' },
        { value: 'me-1', label: 'Me' },
      ],
      meIsAssignable: true,
    }))
    expect(result.current.ownerId).toBe('vacancy-owner-1')
  })

  it('derives owner from candidate when vacancy owner not available', () => {
    const { result } = renderHook(() => useOwnerDerivation({
      vacancyOwnerId: undefined,
      candidateOwnerId: 'candidate-owner-1',
      meId: 'me-1',
      userOptions: [
        { value: 'candidate-owner-1', label: 'Candidate Owner' },
        { value: 'me-1', label: 'Me' },
      ],
      meIsAssignable: true,
    }))
    expect(result.current.ownerId).toBe('candidate-owner-1')
  })

  it('derives owner from logged-in user when neither vacancy nor candidate available', () => {
    const { result } = renderHook(() => useOwnerDerivation({
      vacancyOwnerId: undefined,
      candidateOwnerId: undefined,
      meId: 'me-1',
      userOptions: [{ value: 'me-1', label: 'Me' }],
      meIsAssignable: true,
    }))
    expect(result.current.ownerId).toBe('me-1')
  })

  it('allows manual owner override that prevents auto-seeding', () => {
    const { result, rerender } = renderHook(
      (props) => useOwnerDerivation(props),
      {
        initialProps: {
          vacancyOwnerId: 'vacancy-owner-1',
          candidateOwnerId: undefined,
          meId: 'me-1',
          userOptions: [
            { value: 'vacancy-owner-1', label: 'Vacancy Owner' },
            { value: 'other-owner', label: 'Other Owner' },
            { value: 'me-1', label: 'Me' },
          ],
          meIsAssignable: true,
        },
      }
    )
    expect(result.current.ownerId).toBe('vacancy-owner-1')

    // Manual pick
    act(() => {
      result.current.setOwnerId('other-owner')
    })
    expect(result.current.ownerId).toBe('other-owner')

    // Re-render with a higher-priority owner available — should NOT auto-seed
    rerender({
      vacancyOwnerId: 'new-vacancy-owner',
      candidateOwnerId: undefined,
      meId: 'me-1',
      userOptions: [
        { value: 'new-vacancy-owner', label: 'New Vacancy Owner' },
        { value: 'other-owner', label: 'Other Owner' },
        { value: 'me-1', label: 'Me' },
      ],
      meIsAssignable: true,
    })
    expect(result.current.ownerId).toBe('other-owner')
  })

  it('detects deviation from candidate owner', () => {
    const { result } = renderHook(() => useOwnerDerivation({
      vacancyOwnerId: undefined,
      candidateOwnerId: 'candidate-owner-1',
      meId: 'me-1',
      userOptions: [
        { value: 'candidate-owner-1', label: 'Candidate Owner' },
        { value: 'other-owner', label: 'Other Owner' },
        { value: 'me-1', label: 'Me' },
      ],
      meIsAssignable: true,
    }))
    expect(result.current.ownerDiffersFromCandidate).toBe(false)

    act(() => {
      result.current.setOwnerId('other-owner')
    })
    expect(result.current.ownerDiffersFromCandidate).toBe(true)
  })

  it('detects deviation from vacancy owner', () => {
    const { result } = renderHook(() => useOwnerDerivation({
      vacancyOwnerId: 'vacancy-owner-1',
      candidateOwnerId: undefined,
      meId: 'me-1',
      userOptions: [
        { value: 'vacancy-owner-1', label: 'Vacancy Owner' },
        { value: 'other-owner', label: 'Other Owner' },
        { value: 'me-1', label: 'Me' },
      ],
      meIsAssignable: true,
    }))
    expect(result.current.ownerDiffersFromVacancy).toBe(false)

    act(() => {
      result.current.setOwnerId('other-owner')
    })
    expect(result.current.ownerDiffersFromVacancy).toBe(true)
  })
})
