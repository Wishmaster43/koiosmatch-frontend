import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { VacancyDetailPage } from './VacancyDetailPage'
import { strings } from '../strings'
import * as api from '../api'
import type { VacancyDetail } from '../types'

// Only the network call is mocked — SEO title/meta sync, JSON-LD embedding and the
// four UI states run for real, so this proves the actual rendered DOM, not a callback.
vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return { ...actual, fetchVacancy: vi.fn() }
})

const mockedFetchVacancy = vi.mocked(api.fetchVacancy)
const ORIGINAL_TITLE = document.title

// Builds a full VacancyDetail response — tests override only the field they care about.
function makeVacancy(overrides: Partial<VacancyDetail> = {}): VacancyDetail {
  return {
    reference_number: 'REF-1',
    title: 'Verpleegkundige',
    city: 'Utrecht',
    province: 'Utrecht',
    hours: { from: 24, to: 32 },
    contract_types: ['Uitzenden'],
    salary: null,
    intro: 'Leuke functie in de zorg.',
    published_at: '2026-01-01T00:00:00Z',
    description: '<p>Mooie vacature in de zorg.</p>',
    employment_type: null,
    remote_allowed: false,
    json_ld: { '@context': 'https://schema.org/', '@type': 'JobPosting', title: 'Verpleegkundige' },
    ...overrides,
  }
}

// Renders the page under a real /:tenant/vacatures/:ref route, mirroring App.tsx.
function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={['/acme/vacatures/REF-1']}>
      <Routes>
        <Route path="/:tenant/vacatures/:ref" element={<VacancyDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchVacancy.mockReset()
  document.title = ORIGINAL_TITLE
})

describe('VacancyDetailPage', () => {
  it('sets the document title to "<title> — <city>" for SEO once the vacancy loads', async () => {
    mockedFetchVacancy.mockResolvedValue(makeVacancy())
    renderDetailPage()

    await waitFor(() => expect(document.title).toBe('Verpleegkundige — Utrecht'))
  })

  it('restores the previous document title once the page unmounts', async () => {
    mockedFetchVacancy.mockResolvedValue(makeVacancy())
    const { unmount } = renderDetailPage()

    await waitFor(() => expect(document.title).toBe('Verpleegkundige — Utrecht'))
    unmount()
    expect(document.title).toBe(ORIGINAL_TITLE)
  })

  it('embeds the vacancy JSON-LD as a ld+json script tag in the DOM', async () => {
    const jsonLd = { '@context': 'https://schema.org/', '@type': 'JobPosting', title: 'Verpleegkundige' }
    mockedFetchVacancy.mockResolvedValue(makeVacancy({ json_ld: jsonLd }))
    renderDetailPage()

    await screen.findByRole('heading', { level: 1, name: 'Verpleegkundige' })
    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).toBeTruthy()
    expect(JSON.parse(script?.textContent ?? '')).toEqual(jsonLd)
  })

  it('renders the inline apply section once the vacancy loads', async () => {
    mockedFetchVacancy.mockResolvedValue(makeVacancy())
    renderDetailPage()

    expect(await screen.findByRole('heading', { level: 2, name: strings.apply.heading })).toBeTruthy()
    expect(screen.getByRole('button', { name: strings.apply.submit })).toBeTruthy()
  })

  it('shows the not-found notice, never a script tag, when the fetch fails', async () => {
    mockedFetchVacancy.mockRejectedValue(new Error('404'))
    renderDetailPage()

    expect(await screen.findByText(strings.detail.notFound)).toBeTruthy()
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull()
  })
})
