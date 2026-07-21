import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVacancyInsights } from './useVacancyInsights'
import type { Vacancy } from '@/types/vacancy'
import type { TFunction } from 'i18next'

// Stub translation — returns the key itself so assertions read the raw i18n key
// (mirrors the harness in useVacancyBulkActions.test.ts / mapVacancy.test.js).
const t = ((k: string) => k) as unknown as TFunction
const statusMeta = () => ({ value: '', label: '', color: '' })

// Minimal vacancy row fixture — only the fields the fallback branches read.
const vacancy = (over: Partial<Vacancy> = {}): Vacancy => ({
  id: 'v1', code: '', title: '—', statusValue: null, statusLabel: '', statusColor: '',
  leadsCount: 0, applicationsCount: 0, applicationsByPhase: {}, published: false, publishedChannels: [],
  owner: { id: null, name: '', initials: '?', color: null }, clientId: null, clientName: '',
  tags: [], created: '', createdSort: '', city: '', lat: null, lng: null, distanceKm: null,
  startDate: '', endDate: '', archived: false, archivedAt: null,
  aiAgentId: null, aiAgentName: '', interviewFlowId: null,
  ...over,
})

describe('useVacancyInsights · published donut (V27)', () => {
  it('uses the server-wide by_published aggregate when present', () => {
    const stats = { by_published: [{ value: true, count: 7 }, { value: false, count: 3 }] }
    const { result } = renderHook(() => useVacancyInsights({ stats, vacancies: [], statuses: [], statusMeta, t }))
    expect(result.current.publishedData).toEqual([
      { name: 'publishedState.yes', key: 'published', color: 'var(--color-success)', value: 7 },
      { name: 'publishedState.no', key: 'unpublished', color: '#9CA3AF', value: 3 },
    ])
  })

  it('drops a zero-count bucket instead of showing a dead donut segment', () => {
    const stats = { by_published: [{ value: true, count: 5 }, { value: false, count: 0 }] }
    const { result } = renderHook(() => useVacancyInsights({ stats, vacancies: [], statuses: [], statusMeta, t }))
    expect(result.current.publishedData).toEqual([
      { name: 'publishedState.yes', key: 'published', color: 'var(--color-success)', value: 5 },
    ])
  })

  it('falls back to a page-scope count when the stats slice is missing (old-shape response)', () => {
    const vacancies = [vacancy({ id: 'a', published: true }), vacancy({ id: 'b', published: false })]
    const { result } = renderHook(() => useVacancyInsights({ stats: {}, vacancies, statuses: [], statusMeta, t }))
    expect(result.current.publishedData).toEqual([
      { name: 'publishedState.yes', key: 'published', color: 'var(--color-success)', value: 1 },
      { name: 'publishedState.no', key: 'unpublished', color: '#9CA3AF', value: 1 },
    ])
  })
})

describe('useVacancyInsights · functie donut (V28)', () => {
  it('maps by_category into donut segments, real values only', () => {
    const stats = { by_category: [{ value: 'Verpleegkundige', label: 'Verpleegkundige', count: 4 }, { value: 'Arts', label: 'Arts', count: 2 }] }
    const { result } = renderHook(() => useVacancyInsights({ stats, vacancies: [], statuses: [], statusMeta, t }))
    expect(result.current.categoryData).toEqual([
      { name: 'Verpleegkundige', key: 'Verpleegkundige', value: 4 },
      { name: 'Arts', key: 'Arts', value: 2 },
    ])
  })

  // V28: the null/"Geen functie" bucket has no dedicated `no_category` query param
  // (unlike status' `no_status`) — clicking it couldn't actually filter anything,
  // so it is dropped from the clickable donut entirely (mirrors owner/client).
  it('drops the null/"Geen functie" bucket — there is no backend no_category filter to make it clickable', () => {
    const stats = { by_category: [{ value: null, label: 'Geen functie', count: 9 }, { value: 'Arts', label: 'Arts', count: 2 }] }
    const { result } = renderHook(() => useVacancyInsights({ stats, vacancies: [], statuses: [], statusMeta, t }))
    expect(result.current.categoryData).toEqual([{ name: 'Arts', key: 'Arts', value: 2 }])
  })

  it('is empty (never crashes) when the stats slice is missing — function_title is not on the list row', () => {
    const vacancies = [vacancy()]
    const { result } = renderHook(() => useVacancyInsights({ stats: {}, vacancies, statuses: [], statusMeta, t }))
    expect(result.current.categoryData).toEqual([])
  })
})
