/**
 * CvTemplateSettings — covers the two Danny 28-07 fixes:
 * 1) section names must resolve through i18n by id, never the raw stored
 *    (possibly legacy English) `label` — "About me" must never render, the
 *    candidate drawer's own "Profieltekst" wording must.
 * 2) a tenant can move a movable section between the sidebar and the main
 *    column, and that choice must show up in BOTH the section-list grouping
 *    AND the live A4 preview (they read the same `groupCvSections` source).
 *
 * The real useCvSettings/normalizeCvSections logic runs unmocked — only the
 * underlying settings store (useAllSettings) is replaced with an in-memory
 * fake so the test never hits the network, while still exercising the real
 * migration/normalization + save round-trip.
 */
import { useState, useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import CvTemplateSettings from './CvTemplateSettings'

// In-memory fake for the shared settings store: real getJsonSetting shape,
// just no network — saveSettingsKeys mutates the fake blob and notifies
// subscribers exactly like the real module does (§13: mutation tests must
// assert the actual persisted shape, not just that a callback fired).
let fakeBlob = {}
const listeners = new Set()
vi.mock('@/lib/settings/useAllSettings', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useAllSettings: () => {
      const [v, setV] = useState(() => fakeBlob)
      useEffect(() => {
        const l = (nv) => setV(nv)
        listeners.add(l)
        return () => listeners.delete(l)
      }, [])
      return v
    },
    saveSettingsKeys: vi.fn(async (partial) => {
      const stringified = {}
      for (const [k, v] of Object.entries(partial)) stringified[k] = typeof v === 'string' ? v : JSON.stringify(v)
      fakeBlob = { ...fakeBlob, ...stringified }
      listeners.forEach(l => l(fakeBlob))
    }),
  }
})
// Brand settings (logo/company name) — irrelevant here, resolve empty.
vi.mock('../lib/settingsApi', () => ({ loadSettings: vi.fn(async () => ({})) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
const ct = (key, opts) => i18n.t(key, { ns: 'candidates', ...opts })

// A legacy blob exactly as it would have been saved BEFORE per-section
// placement AND i18n section labels existed: hardcoded English labels, no
// `placement` field at all.
const LEGACY_SECTIONS = [
  { id: 'contact',      label: 'Contact details', enabled: true },
  { id: 'summary',      label: 'About me',        enabled: true },
  { id: 'experience',   label: 'Work experience', enabled: true },
  { id: 'education',    label: 'Education',       enabled: true },
  { id: 'languages',    label: 'Languages',       enabled: true },
  { id: 'skills',       label: 'Skills',          enabled: true },
  { id: 'certificates', label: 'Certificates',    enabled: true },
  { id: 'preferences',  label: 'Preferences',     enabled: false },
]

beforeEach(() => {
  listeners.clear()
  fakeBlob = {
    candidate_cv_template: JSON.stringify({
      // eslint-disable-next-line no-restricted-syntax -- DATA: mirrors the real default accent-colour seed, not UI styling
      primaryColor: '#19A5CA', secondaryColor: '#1B60A9', logoUrl: null, companyName: '', sections: LEGACY_SECTIONS,
    }),
  }
})

describe('CvTemplateSettings — section naming (i18n, not the stored label)', () => {
  it('shows the candidate-drawer wording for the profile text, never the legacy "About me" label', () => {
    render(<CvTemplateSettings />)
    // The drawer's own field name — "one concept, one name" (Danny's report).
    expect(screen.getAllByText(ct('cv.summary')).length).toBeGreaterThan(0)
    expect(screen.queryByText('About me')).not.toBeInTheDocument()
    expect(screen.queryByText('Contact details')).not.toBeInTheDocument()
    expect(screen.queryByText('Work experience')).not.toBeInTheDocument()
  })
})

describe('CvTemplateSettings — legacy blob renders unchanged (migration safety)', () => {
  it("resolves every legacy section into today's default region", () => {
    render(<CvTemplateSettings />)
    const sidebarGroup = screen.getByTestId('cv-section-group-sidebar')
    const mainGroup = screen.getByTestId('cv-section-group-main')
    expect(within(sidebarGroup).getByText(ct('cv.contact'))).toBeInTheDocument()
    expect(within(sidebarGroup).getByText(ct('cv.languages'))).toBeInTheDocument()
    expect(within(sidebarGroup).getByText(ct('cv.skills'))).toBeInTheDocument()
    expect(within(sidebarGroup).getByText(ct('cv.certificates'))).toBeInTheDocument()
    expect(within(mainGroup).getByText(ct('cv.experience'))).toBeInTheDocument()
    expect(within(mainGroup).getByText(ct('cv.education'))).toBeInTheDocument()
    expect(within(mainGroup).getByText(ct('cv.preferences'))).toBeInTheDocument()
  })

  it('renders the live preview with languages still in the sidebar (default layout)', () => {
    render(<CvTemplateSettings />)
    const sidebarPreview = screen.getByTestId('cv-preview-sidebar')
    expect(within(sidebarPreview).getByText('Nederlands')).toBeInTheDocument()
  })
})

describe('CvTemplateSettings — moving a section between regions', () => {
  it('moving "languages" to the main column updates BOTH the section list and the live preview', async () => {
    render(<CvTemplateSettings />)

    // Sanity: starts in the sidebar (both the editor list and the preview).
    expect(within(screen.getByTestId('cv-section-group-sidebar')).getByText(ct('cv.languages'))).toBeInTheDocument()
    expect(within(screen.getByTestId('cv-preview-sidebar')).getByText('Nederlands')).toBeInTheDocument()

    // Click the "main column" region button next to the Languages row (scoped
    // to the sidebar group so it can't accidentally match the preview's own
    // "Talen"/"Languages" section heading, which uses the same translation key).
    const languagesLabel = within(screen.getByTestId('cv-section-group-sidebar')).getByText(ct('cv.languages'))
    const languagesRow = languagesLabel.closest('div')
    const moveToMainBtn = within(languagesRow).getByRole('button', {
      name: st('cvTemplate.moveSectionToRegion', { section: ct('cv.languages'), region: st('cvTemplate.regionMain') }),
    })
    fireEvent.click(moveToMainBtn)

    // Assert the REQUEST (§13): the persisted blob actually carries the new placement.
    await waitFor(() => {
      const stored = JSON.parse(fakeBlob.candidate_cv_template)
      const languages = stored.sections.find(s => s.id === 'languages')
      expect(languages.placement).toBe('main')
    })

    // The section-list grouping AND the live preview both reflect the move —
    // proof they read the same groupCvSections source, not two diverging copies.
    await waitFor(() => {
      expect(within(screen.getByTestId('cv-section-group-main')).getByText(ct('cv.languages'))).toBeInTheDocument()
    })
    expect(within(screen.getByTestId('cv-section-group-sidebar')).queryByText(ct('cv.languages'))).not.toBeInTheDocument()

    await waitFor(() => {
      expect(within(screen.getByTestId('cv-preview-main')).getByText('Nederlands')).toBeInTheDocument()
    })
    expect(within(screen.getByTestId('cv-preview-sidebar')).queryByText('Nederlands')).not.toBeInTheDocument()
  })

  it('does not offer a region picker for experience/education (structurally fixed to main)', () => {
    render(<CvTemplateSettings />)
    const mainGroup = screen.getByTestId('cv-section-group-main')
    // No "move to sidebar" control exists anywhere for these ids.
    expect(screen.queryByRole('button', {
      name: st('cvTemplate.moveSectionToRegion', { section: ct('cv.experience'), region: st('cvTemplate.regionSidebar') }),
    })).not.toBeInTheDocument()
    // Instead a plain, non-interactive region badge is shown.
    expect(within(mainGroup).getAllByText(st('cvTemplate.regionMain')).length).toBeGreaterThan(0)
  })
})
