/**
 * CustomFieldsTab — regression test for the shared "Extra" drawer tab (§3A(f)):
 * it must render NOTHING when the entity has no active custom-field defs (the
 * drawer itself also gates the tab out of the tab list — this is the belt-and-
 * braces check inside the component), and render the current values once defs exist.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import CustomFieldsTab from './CustomFieldsTab'
import { useCustomFields } from '@/lib/useCustomFields'

vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: vi.fn() }))
const mockedUseCustomFields = vi.mocked(useCustomFields)

afterEach(() => vi.clearAllMocks())

describe('CustomFieldsTab', () => {
  it('renders nothing while loading', () => {
    mockedUseCustomFields.mockReturnValue({ fields: [], allFields: [], loading: true, invalidate: vi.fn() })
    const { container } = render(<CustomFieldsTab entityType="task" values={{}} onSave={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there are no active defs (no defs → no tab content)', () => {
    mockedUseCustomFields.mockReturnValue({ fields: [], allFields: [], loading: false, invalidate: vi.fn() })
    const { container } = render(<CustomFieldsTab entityType="task" values={{}} onSave={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the field label + current value once ≥1 active def exists', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'budget', label: 'Budget', type: 'number', sort_order: 0, active: true, has_data: false, visible_in_ui: true }],
      allFields: [],
      loading: false,
      invalidate: vi.fn(),
    })
    render(<CustomFieldsTab entityType="task" values={{ budget: 500 }} onSave={vi.fn()} />)
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  // G34: the select-type field is the house CreatableSelect (allowCreate={false}),
  // never a native <select> — proves the same onSave({ key: value }) patch shape
  // as before through the new click-to-open interaction.
  it('the select-type field is the house CreatableSelect, not a native <select>, and edits/saves the picked value', async () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'region', label: 'Regio', type: 'select', options: ['Noord', 'Zuid'], sort_order: 0, active: true, has_data: false, visible_in_ui: true }],
      allFields: [],
      loading: false,
      invalidate: vi.fn(),
    })
    const onSave = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<CustomFieldsTab entityType="task" values={{ region: 'Noord' }} onSave={onSave} />)

    await user.click(screen.getByTitle('Bewerken'))
    expect(container.querySelector('select')).toBeNull()

    // Trigger's accessible name = "<field label> <current value>" (aria-labelledby).
    await user.click(screen.getByRole('button', { name: 'Regio Noord' }))
    await user.click(await screen.findByRole('button', { name: 'Zuid' }))
    await user.click(screen.getByTitle('Opslaan'))

    expect(onSave).toHaveBeenCalledWith({ region: 'Zuid' })
  })

  // Danny 22-07 point 12: the fields must render inside the shared titled-card frame
  // (border/surface + uppercase group title) — it used to float with no card at all.
  it('renders the simple fields inside a titled, bordered card', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'budget', label: 'Budget', type: 'number', sort_order: 0, active: true, has_data: false, visible_in_ui: true }],
      allFields: [],
      loading: false,
      invalidate: vi.fn(),
    })
    render(<CustomFieldsTab entityType="task" values={{ budget: 500 }} onSave={vi.fn()} />)
    // The group title sits above the card, mirroring the Persoonlijk/Contact cards.
    expect(screen.getByText('Eigen velden')).toBeInTheDocument()
    // The card frame carries the shared bordered-surface style (SectionCard's sectionBlock).
    const card = screen.getByText('Budget').parentElement?.parentElement as HTMLElement
    expect(card.style.border).toBe('1px solid var(--border)')
    expect(card.style.background).toBe('var(--surface)')
  })
})
