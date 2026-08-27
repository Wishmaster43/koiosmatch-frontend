/**
 * demoSeedTexts apply-site — DEMO-SEED-TAAL-1. Proves the wiring at a real display
 * site (the customer company-text block, EditableRichTextField): read mode shows
 * the catalogue translation for the demo tenant on a non-Dutch UI language, while
 * the editor (pencil open) keeps editing the STORED Dutch text untouched — a
 * translated draft would silently overwrite the tenant's real seed on save.
 *
 * react-i18next is mocked here (not the real @/i18n runtime) so `t()` keeps
 * returning its raw key as every other EditableRichTextField test relies on —
 * only `i18n.language` is faked, which is all useSeedText actually reads.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableRichTextField from '@/pages/customers/drawer/EditableRichTextField'
import { getActiveTenantId } from '@/lib/api'

// Minimal stand-in for the Tiptap editor, mirroring EditableRichTextField.test.tsx.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

// Only getActiveTenantId is faked — the rest of api.ts is unused by this component.
vi.mock('@/lib/api', () => ({ getActiveTenantId: vi.fn(() => 'demo') }))
const mockedTenantId = vi.mocked(getActiveTenantId)

// Fake i18n language for useSeedText, while every t() call still returns its raw
// key — exactly the fallback every other test in this component relies on.
let mockLanguage = 'de'
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: mockLanguage } }),
}))

const NL_TEXT = 'Action DC is een logistiek dienstverlener en vaste klant.\n\n## Schrijfstijl\nZakelijk en direct\n\n## Wervingsproblemen\nPiekdrukte vraagt om snelle flexinstroom.'
const DE_TRANSLATION_START = 'Action DC ist ein Logistikdienstleister und fester Kunde.'

describe('EditableRichTextField · DEMO-SEED-TAAL-1 apply site', () => {
  it('read mode shows the translation; the editor (pencil open) shows the stored NL text', async () => {
    mockedTenantId.mockReturnValue('demo')
    mockLanguage = 'de'
    const user = userEvent.setup()
    const { container } = render(<EditableRichTextField label="Bedrijfstekst" value={NL_TEXT} onSave={() => {}} />)
    // Read mode: the German catalogue translation renders (the chunk loads
    // asynchronously), the stored Dutch text does not.
    await waitFor(() => expect(container.textContent).toContain(DE_TRANSLATION_START))
    expect(container.textContent).not.toContain('Action DC is een logistiek dienstverlener')
    // Editor: the ORIGINAL stored Dutch text, never the display translation.
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByTestId('rte')).toHaveValue(NL_TEXT)
  })

  it('a real (non-demo) tenant sees the stored NL text even in read mode', () => {
    mockedTenantId.mockReturnValue('acme')
    mockLanguage = 'de'
    const { container } = render(<EditableRichTextField label="Bedrijfstekst" value={NL_TEXT} onSave={() => {}} />)
    expect(container.textContent).toContain('Action DC is een logistiek dienstverlener')
    expect(container.textContent).not.toContain(DE_TRANSLATION_START)
  })
})
