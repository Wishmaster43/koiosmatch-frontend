/** BackgroundTab · 422 error display, required-message and skills key adoption (split from BackgroundTab.test.tsx; real i18n nl). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackgroundTab from './BackgroundTab'
import type { Candidate } from '@/types/candidate'

// Resolve (never reject) empty lists: useSkillLevels/useLanguageLookups build on
// the shared useCachedLookup, which chains an un-caught `.finally()` on the raw
// request promise — a rejection there surfaces as an unhandled rejection warning
// unrelated to anything under test here.
vi.mock('@/lib/api', () => ({
  getActiveTenantId: () => 'demo',
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notify: vi.fn() }))
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const candidate = (): Candidate => ({ id: 1, experiences: [], educations: [], certifications: [], skills: [], languages: [] } as unknown as Candidate)

/**
 * KAND-ACHTERGROND-VERPLICHT-1 (2026-08-17, Danny: "staat geen sterrentje bij" /
 * "waarom kan ik opslaan zonder in te vullen?"): per sub-tab, the ONE field the
 * backend's own controller `rules()` actually requires on create — measured
 * live against koiosmatch-api (CandidateExperienceController::employer,
 * CandidateEducationController::title, CandidateCertificationController::name,
 * CandidateSkillController::name, CandidateReferenceController::last_name). Each
 * case: the field carries the visible asterisk, an empty Save fires NO request
 * at all (§13), and a filled Save sends the real POST with that exact body key.
 */
describe.each([
  { tab: 'Ervaring', route: 'experiences', placeholder: 'Bedrijf', value: 'Zorggroep Noord', bodyKey: 'employer' },
  { tab: 'Opleiding', route: 'educations', placeholder: 'Diploma', value: 'Verpleegkunde', bodyKey: 'title' },
  { tab: 'Certificeringen', route: 'certifications', placeholder: 'Certificeringnaam', value: 'VCA Basis', bodyKey: 'name' },
  { tab: 'Vaardigheden', route: 'skills', placeholder: 'Vaardigheid', value: 'Excel', bodyKey: 'name' },
  { tab: 'Referenties', route: 'references', placeholder: 'Achternaam', value: 'Jansen', bodyKey: 'last_name' },
])('BackgroundTab · $tab required field (KAND-ACHTERGROND-VERPLICHT-1)', ({ tab, route, placeholder, value, bodyKey }) => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.post).mockResolvedValue({})
  })

  it('marks the field required, blocks an empty Save (no request sent), then sends the real request once filled', async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: tab }))
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))

    // 1) NO REQUIRED MARKER was the first defect. The marker lives IN the
    // placeholder rather than in a caption above the field: a caption made the
    // required field taller than its neighbours in this compact row and threw the
    // whole line out of alignment (Danny 17-08). So the assertion is that the
    // field is findable by its marked placeholder, which also proves the row keeps
    // one box height for every field.
    expect(screen.getByPlaceholderText(`${placeholder} *`)).toBeInTheDocument()

    // 2) SAVE IS ALLOWED WITH IT EMPTY was the third defect — clicking Save
    // without filling the required field must reach the API zero times.
    fireEvent.click(screen.getByTitle('Opslaan'))
    expect(api.post).not.toHaveBeenCalled()

    // Filling it in and saving again now sends the real, correctly-shaped request.
    await user.type(screen.getByPlaceholderText(`${placeholder} *`), value)
    fireEvent.click(screen.getByTitle('Opslaan'))
    expect(api.post).toHaveBeenCalledWith(`/candidates/1/${route}`, expect.objectContaining({ [bodyKey]: value }), expect.anything())
  })
})

/**
 * KAND-ACHTERGROND-VERPLICHT-1: the raw-error leak, defect four. A validation
 * 422 shaped exactly like Laravel's own untranslated default message (no
 * lang/nl/validation.php on the backend — see extractApiError's header) must
 * never reach the toast verbatim; BackgroundTab's requiredFieldLabels map turns
 * it into OUR translated copy instead. This is a residual-case guard — the
 * describe block above proves the client already blocks the common path.
 */
describe('BackgroundTab · a raw "required" 422 renders our translated message, never the server string', () => {
  it('shows the translated field-required copy instead of "The employer field is required."', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.post).mockRejectedValue({
      response: { status: 422, data: { message: 'The given data was invalid.', errors: { employer: ['The employer field is required.'] } } },
    })
    vi.mocked(notifyError).mockClear()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole('tab', { name: 'Ervaring' }))
    await user.click(screen.getByRole('button', { name: 'Toevoegen' }))
    // Fill in the OTHER field the client checks (title) so this exercises the
    // residual server-side 422 path, not the client-side block covered above.
    await user.type(screen.getByPlaceholderText('Bedrijf *'), 'Zorggroep Noord')
    fireEvent.click(screen.getByTitle('Opslaan'))

    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    const shown = vi.mocked(notifyError).mock.calls[0][0] as string
    expect(shown).not.toBe('The employer field is required.')
    expect(shown).not.toContain('The employer field')
  })
})


/**
 * DOC-1-EIGENAAR-1 punt 5 (het vangnet): even with a correct picker the 422 can still
 * happen (a second tab, a stale list). The recruiter must then read the SERVER’s own
 * reason, never a generic "actie mislukt" — and api.ts’s dev diagnostic toast is
 * silenced for 422 so it cannot bury it (quietStatuses, asserted above).
 */
describe("BackgroundTab 422 error display", () => {
  it("shows the backend message instead of generic fallback", async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.patch).mockRejectedValue({
      response: { status: 422, data: { message: "Dit document is al aan een ander onderdeel gekoppeld.", errors: { document_id: ["Dit document is al aan een ander onderdeel gekoppeld."] } } },
    })
    vi.mocked(notifyError).mockClear()
    render(<BackgroundTab c={{
      ...candidate(),
      certifications: [{ id: "c1", name: "VCA Basis" }],
      documents: [{ id: "doc-free", name: "vrij.pdf" }],
    } as unknown as Candidate} />)
    await user.click(screen.getByRole("tab", { name: "Certificeringen" }))
    await user.click(screen.getByTitle("Bewerken"))
    await user.click(screen.getByRole("button", { name: "Gekoppeld document" }))
    await user.click(await screen.findByRole("button", { name: "vrij.pdf" }))
    await user.click(screen.getByTitle("Opslaan"))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith("Dit document is al aan een ander onderdeel gekoppeld."))
  })
})

/**
 * KEY-ADOPTION skills level_key (K-277): BackgroundTab sends level_key
 * alongside the legacy level name when a skill is added or edited.
 */
describe("BackgroundTab KEY-ADOPTION skills", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.post).mockResolvedValue({})
    vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } })
  })

  it("POSTs skills with level_key in the request body", async () => {
    const user = userEvent.setup()
    render(<BackgroundTab c={candidate()} />)
    await user.click(screen.getByRole("tab", { name: "Vaardigheden" }))
    await user.click(screen.getByRole("button", { name: "Toevoegen" }))
    await user.type(screen.getByPlaceholderText("Vaardigheid *"), "Excel")
    fireEvent.click(screen.getByTitle("Opslaan"))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/candidates/1/skills",
      { name: "Excel", level: "", level_key: null, document_id: null },
      { quietStatuses: [422] }
    ))
  })

  it("PATCHes skills with level_key preserved across renames", async () => {
    const user = userEvent.setup()
    const c = {
      ...candidate(),
      skills: [{ id: "s1", name: "Excel", level: "Expert", levelKey: "expert_key" }],
    } as unknown as Candidate
    render(<BackgroundTab c={c} />)
    await user.click(screen.getByRole("tab", { name: "Vaardigheden" }))
    await user.click(screen.getByTitle("Bewerken"))
    const input = screen.getByDisplayValue("Excel")
    await user.clear(input)
    await user.type(input, "Excel Advanced")
    fireEvent.click(screen.getByTitle("Opslaan"))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      "/candidates/1/skills/s1",
      expect.objectContaining({
        name: "Excel Advanced",
        level: "Expert",
        level_key: "expert_key",
      }),
      expect.anything()
    ))
  })
})
