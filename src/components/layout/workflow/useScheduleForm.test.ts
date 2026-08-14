/**
 * useScheduleForm · WORKFLOW-SCHEMA-1 — asserts the exact `trigger_config` body
 * Save produces per frequency (the backend contract's own field names, flat, no
 * `schedule_type` wrapper), and that the three legacy shapes load into the
 * right controls and re-save an equivalent, valid config.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useScheduleForm } from './useScheduleForm'

describe('useScheduleForm · Save request body per frequency', () => {
  it('daily — one time', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'daily', times: ['09:00'] }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'daily', times: ['09:00'] })
  })

  it('weekly — weekdays + times', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'weekly', weekdays: [1, 4], times: ['09:00'] }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'weekly', times: ['09:00'], weekdays: [1, 4] })
  })

  it('monthly — monthday + times', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'monthly', monthday: 31, times: ['09:00'] }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'monthly', times: ['09:00'], monthday: 31 })
  })

  it('quarterly — monthday + times', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'quarterly', monthday: 1, times: ['09:00'] }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'quarterly', times: ['09:00'], monthday: 1 })
  })

  it('yearly — month + monthday + times', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'yearly', month: 2, monthday: 1, times: ['09:00'] }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'yearly', times: ['09:00'], monthday: 1, month: 2 })
  })

  it('interval — interval_minutes only, no times key', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'interval', interval_minutes: 30 }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'interval', interval_minutes: 30 })
  })

  it('interval below the 5-minute contract floor blocks Save (canSave=false)', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { frequency: 'interval', interval_minutes: 30 }, onSave))
    act(() => result.current.setIntervalMinutes(2))
    expect(result.current.canSave).toBe(false)
    act(() => result.current.handleSave())
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('useScheduleForm · legacy shapes load into the right controls', () => {
  it('a single schedule_time seeds daily with one time', () => {
    const { result } = renderHook(() => useScheduleForm('Scheduled', { schedule_time: '07:30' }, vi.fn()))
    expect(result.current.frequency).toBe('daily')
    expect(result.current.times).toEqual(['07:30'])
  })

  it('a bare times array with no frequency seeds daily', () => {
    const { result } = renderHook(() => useScheduleForm('Scheduled', { times: ['06:00', '18:00'] }, vi.fn()))
    expect(result.current.frequency).toBe('daily')
    expect(result.current.times).toEqual(['06:00', '18:00'])
  })

  it('schedule: "weekly" + an ISO day number seeds weekly with that weekday', () => {
    const { result } = renderHook(() => useScheduleForm('Scheduled', { schedule: 'weekly', day: 4, time: '09:00' }, vi.fn()))
    expect(result.current.frequency).toBe('weekly')
    expect(result.current.weekdays).toEqual([4])
    expect(result.current.times).toEqual(['09:00'])
  })

  it('schedule: "weekly" + an English weekday name seeds the matching ISO weekday', () => {
    const { result } = renderHook(() => useScheduleForm('Scheduled', { schedule: 'weekly', day: 'monday', time: '09:00' }, vi.fn()))
    expect(result.current.frequency).toBe('weekly')
    expect(result.current.weekdays).toEqual([1])
  })

  it('a loaded legacy config re-saves as an equivalent, valid current-contract body', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useScheduleForm('Scheduled', { schedule: 'weekly', day: 'thursday', time: '09:00' }, onSave))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith('Scheduled', { frequency: 'weekly', times: ['09:00'], weekdays: [4] })
  })
})
