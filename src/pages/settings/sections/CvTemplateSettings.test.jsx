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
import { loadSettings } from '../lib/settingsApi'

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
const cmt = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

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

    // Click the "main column" region radio next to the Languages row (scoped to the
    // sidebar group so it can't accidentally match the preview's own "Talen"/
    // "Languages" section heading, which uses the same translation key). The
    // region switch is now the shared SegmentedControl (audit finding 05-08): a
    // radiogroup named after the section itself, with each option's own visible
    // text ("Zijbalk"/"Hoofdkolom") as its accessible name.
    const languagesLabel = within(screen.getByTestId('cv-section-group-sidebar')).getByText(ct('cv.languages'))
    const languagesRow = languagesLabel.closest('div')
    const moveToMainBtn = within(languagesRow).getByRole('radio', { name: st('cvTemplate.regionMain') })
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
    // No region radiogroup exists anywhere in the Experience row.
    const experienceRow = within(mainGroup).getByText(ct('cv.experience')).closest('div')
    expect(within(experienceRow).queryByRole('radiogroup')).not.toBeInTheDocument()
    // Instead a plain, non-interactive region badge is shown.
    expect(within(mainGroup).getAllByText(st('cvTemplate.regionMain')).length).toBeGreaterThan(0)
  })
})

// Both the native colour swatch (type="color") and the hex text field share
// the same accessible name (they edit the same value) — getByLabelText
// legitimately returns both, so tests that need the TEXT field specifically
// disambiguate by control type.
const getHexTextInput = (label) => screen.getAllByLabelText(label).find(el => el.type === 'text')

/* eslint-disable no-restricted-syntax -- DATA: hex values asserted/typed by the test (seed default, arbitrary complete value, fixed swatch colour), not a style rule. */
describe('CvTemplateSettings — hex field only persists a complete colour', () => {
  it('never writes a half-typed value to the tenant settings, but keeps the field freely typable', () => {
    render(<CvTemplateSettings />)
    const hexInput = getHexTextInput(st('cvTemplate.color1'))

    // Half-typed input: must never reach saveSettingsKeys / the persisted blob.
    fireEvent.change(hexInput, { target: { value: '#1' } })
    expect(JSON.parse(fakeBlob.candidate_cv_template).primaryColor).toBe('#19A5CA')
    // The field itself must still show what the user typed — no caret fight.
    expect(hexInput.value).toBe('#1')

    // Finishing the value to a complete #RRGGBB now persists it.
    fireEvent.change(hexInput, { target: { value: '#123ABC' } })
    expect(JSON.parse(fakeBlob.candidate_cv_template).primaryColor).toBe('#123ABC')
  })

  it('resyncs the draft from the persisted value when changed from outside the text field (swatch pick)', () => {
    render(<CvTemplateSettings />)
    const hexInput = getHexTextInput(st('cvTemplate.color2'))
    const swatchBtn = screen.getByRole('button', { name: `${st('cvTemplate.color2')} #10B981` })
    fireEvent.click(swatchBtn)
    expect(hexInput.value).toBe('#10B981')
  })
})
/* eslint-enable no-restricted-syntax */

describe('CvTemplateSettings — accent swatch accessibility', () => {
  it('gives every colour swatch an accessible name and conveys selection via aria-pressed, not colour/border alone', () => {
    render(<CvTemplateSettings />)
    const selected = screen.getByRole('button', { name: `${st('cvTemplate.color1')} #19A5CA` })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    const unselected = screen.getByRole('button', { name: `${st('cvTemplate.color1')} #1B60A9` })
    expect(unselected).toHaveAttribute('aria-pressed', 'false')
  })

  it('associates a real <label> with each hex input via htmlFor/id', () => {
    render(<CvTemplateSettings />)
    // getByLabelText throws if no control is programmatically associated with the text.
    expect(getHexTextInput(st('cvTemplate.color1'))).toBeInTheDocument()
    expect(getHexTextInput(st('cvTemplate.color2'))).toBeInTheDocument()
  })
})

describe('CvTemplateSettings — brand-settings load failure is distinguishable from "not configured"', () => {
  it('shows a notice when the brand-settings load fails (never silently reads as empty)', async () => {
    loadSettings.mockRejectedValueOnce(new Error('network down'))
    render(<CvTemplateSettings />)
    await waitFor(() => {
      expect(screen.getByText(cmt('errorGeneric'))).toBeInTheDocument()
    })
  })

  it('shows no notice when the brand settings genuinely resolve empty', async () => {
    render(<CvTemplateSettings />)
    await waitFor(() => expect(loadSettings).toHaveBeenCalled())
    expect(screen.queryByText(cmt('errorGeneric'))).not.toBeInTheDocument()
  })
})
