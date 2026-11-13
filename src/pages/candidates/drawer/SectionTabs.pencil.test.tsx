/** SectionTabs · description edit via the one row pencil (split from SectionTabs.test.tsx; real i18n nl). */
import i18n from '@/i18n'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceTab, CertificationsTab } from './SectionTabs'

// KAND-NIVEAU-1: EducationTab now also fires useEducationLevels' GET (built on the
// shared useCachedLookup) — resolve it with an empty list so no real network call
// fires and the hook's fallback seed renders (mirrors BackgroundTab.test.tsx's
// identical mock, added there for the same reason with useSkillLevels).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
  // useCachedLookup (behind useEducationLevels/useSkillLevels) keys its cache by
  // the active tenant — stub it so those hooks resolve instead of throwing.
  getActiveTenantId: () => 'test-tenant',
}))

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
describe('CertificationsTab · description read-only, edited via the ONE row pencil (C-13c, DRAWER-ONE-PENCIL-1)', () => {
  it('renders the saved description through SafeHtml, not a bare textarea, with no field-level pencil of its own', () => {
    const item = { id: 'c1', name: 'VCA Basis', desc: '<p>Basisveiligheid <strong>VOL</strong></p>' }
    render(<CertificationsTab items={[item]} />)
    expect(screen.getByText('Basisveiligheid')).toBeInTheDocument()
    expect(screen.getByText('VOL').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull() // no bare <textarea> in read mode
    // No onEdit passed → AddableSection renders no row pencil either (no fake affordance).
    expect(screen.queryByTitle(i18n.t('common:edit'))).toBeNull()
  })

  it('edits the description through the ONE row-level pencil — the save payload carries the edited desc html', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', org: 'SSVV', desc: '<p>Basisveiligheid</p>' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} />)

    // Exactly ONE 'Bewerken' pencil now — the description no longer has its own (the fix).
    expect(screen.getAllByTitle(i18n.t('common:edit'))).toHaveLength(1)
    await user.click(screen.getByTitle(i18n.t('common:edit')))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Basisveiligheid</p>')
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Edited</p>')
    await user.click(screen.getByTitle(i18n.t('common:save')))

    // §13: assert the REQUEST payload, not just that the callback fired — the edited
    // desc html rides along in the SAME row-level save (merged with the other fields).
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ desc: '<p>Edited</p>' }))
  })

  it('cancel discards the draft without calling onEdit', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'c1', name: 'VCA Basis', desc: '<p>Basisveiligheid</p>' }
    render(<CertificationsTab items={[item]} onEdit={onEdit} />)
    await user.click(screen.getByTitle(i18n.t('common:edit')))
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Discarded</p>')
    await user.click(screen.getByTitle(i18n.t('common:cancel')))
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Basisveiligheid')).toBeInTheDocument()
  })
})

describe('ExperienceTab · description read-only, edited via the ONE row pencil (C-14, DRAWER-ONE-PENCIL-1)', () => {
  it('shows the description via SafeHtml and edits it through the single row-level pencil', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const item = { id: 'x1', title: 'Verpleegkundige', company: 'Yesway', desc: '<p>Zorgtaken</p>' }
    render(<ExperienceTab items={[item]} onEdit={onEdit} />)

    expect(screen.getByText('Zorgtaken')).toBeInTheDocument()
    // Exactly ONE 'Bewerken' pencil — the description no longer has its own (the fix).
    expect(screen.getAllByTitle(i18n.t('common:edit'))).toHaveLength(1)
    await user.click(screen.getByTitle(i18n.t('common:edit')))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Zorgtaken</p>')
    await user.click(screen.getByTitle(i18n.t('common:save')))
    // §13: assert the REQUEST payload — the row save carries the (unchanged) desc html
    // merged alongside the other row fields, not a separate partial-desc call.
    expect(onEdit).toHaveBeenCalledWith(0, expect.objectContaining({ desc: '<p>Zorgtaken</p>' }))
  })

  it('renders the description as a rich-text field INSIDE the row-level edit form (one pencil owns it all)', async () => {
    const user = userEvent.setup()
    const item = { id: 'x1', title: 'Verpleegkundige', company: 'Yesway', desc: '<p>Zorgtaken</p>' }
    render(<ExperienceTab items={[item]} onEdit={vi.fn()} />)
    await user.click(screen.getByTitle(i18n.t('common:edit')))
    // The row form (title/company/location/dates/current) now ALSO renders the
    // description — mocked as the `rte` textarea — inside the SAME form.
    expect(screen.getByTestId('rte')).toBeInTheDocument()
  })
})
