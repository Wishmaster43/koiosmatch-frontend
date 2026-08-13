/**
 * DescriptionTab — Danny 21-07: the vacancy description split OUT of DetailsTab's
 * Profiel sub-tab into its own drawer main-tab. Covers the read↔edit toggle
 * (SafeHtml when read, RichTextEditor once the pencil is clicked) and that Save
 * actually persists via the shared onUpdate path (buildVacancyPatch → PATCH).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DescriptionTab from './DescriptionTab'
import type { VacancyDetail } from '@/types/vacancy'

// RichTextEditor/SafeHtml are heavy third-party-backed editors — stub with a
// minimal controlled surface so this test only exercises DescriptionTab's own
// state, mirroring the candidate ProfileTab.test.tsx convention. `assistModes`
// is surfaced as a data attribute so ACTIONS-SCOPE-DEFAULT-FLIP (no actiepunten
// on a description field, via the shared default — no per-field override) can
// be asserted without mounting the real assist bar.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistModes }: { value: string; onChange: (v: string) => void; assistModes?: string[] }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)}
      data-assist-modes={assistModes ? assistModes.join(',') : undefined} />
  ),
}))
vi.mock('@/components/ui/SafeHtml', () => ({
  default: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div>,
}))
// Not under test here — makes its own resolve/generate API calls, irrelevant to this tab's toggle/save.
vi.mock('./VacancyGenerateFlow', () => ({ default: () => null }))

const vacancy = { id: 'v1', title: 'Verpleegkundige', description: '<p>Huidige tekst</p>' } as unknown as VacancyDetail

describe('DescriptionTab · read state', () => {
  it('renders the saved description as SafeHtml', () => {
    render(<DescriptionTab vacancy={vacancy} onUpdate={vi.fn()} />)
    expect(screen.getByTestId('safe-html')).toHaveTextContent('Huidige tekst')
    expect(screen.queryByLabelText('rich-text-editor')).not.toBeInTheDocument()
  })

  it('shows a dash placeholder when there is no description yet', () => {
    render(<DescriptionTab vacancy={{ ...vacancy, description: '' } as VacancyDetail} onUpdate={vi.fn()} />)
    expect(screen.queryByTestId('safe-html')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('DescriptionTab · edit + save', () => {
  it('clicking the pencil swaps SafeHtml for the RichTextEditor', () => {
    render(<DescriptionTab vacancy={vacancy} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('common:edit'))
    expect(screen.getByLabelText('rich-text-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('safe-html')).not.toBeInTheDocument()
  })

  it('passes no explicit assistModes override — a vacancy description is a description, not a conversation, so it inherits the shared improve+summarize-only default', () => {
    render(<DescriptionTab vacancy={vacancy} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('common:edit'))
    // The mock only sets the attribute when a value is passed — its absence
    // proves NO explicit override reaches RichTextEditor (undefined `assistModes`).
    expect(screen.getByLabelText('rich-text-editor')).not.toHaveAttribute('data-assist-modes')
  })

  it('save persists the edited description via onUpdate(id, { description })', () => {
    const onUpdate = vi.fn()
    render(<DescriptionTab vacancy={vacancy} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('common:edit'))
    fireEvent.change(screen.getByLabelText('rich-text-editor'), { target: { value: '<p>Nieuwe tekst</p>' } })
    fireEvent.click(screen.getByTitle('common:save'))
    expect(onUpdate).toHaveBeenCalledWith('v1', { description: '<p>Nieuwe tekst</p>' })
    // Save returns the block to read mode.
    expect(screen.queryByLabelText('rich-text-editor')).not.toBeInTheDocument()
  })

  it('cancel discards the draft without calling onUpdate', () => {
    const onUpdate = vi.fn()
    render(<DescriptionTab vacancy={vacancy} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('common:edit'))
    fireEvent.change(screen.getByLabelText('rich-text-editor'), { target: { value: '<p>Weggegooid</p>' } })
    fireEvent.click(screen.getByTitle('common:cancel'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByTestId('safe-html')).toHaveTextContent('Huidige tekst')
  })
})

// V-desc-1: the second-screen pop-out icon.
describe('DescriptionTab · second-screen pop-out', () => {
  it('renders a pop-out icon that opens /popout/text/vacancy/{id}/description', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    render(<DescriptionTab vacancy={vacancy} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByTitle('common:openSecondScreen'))
    expect(openSpy).toHaveBeenCalledWith('/popout/text/vacancy/v1/description', expect.stringContaining('koios-text-vacancy-v1-description'), expect.any(String))
    // Opening it also starts an edit, same as the pencil.
    expect(screen.getByLabelText('rich-text-editor')).toBeInTheDocument()
    openSpy.mockRestore()
  })
})
