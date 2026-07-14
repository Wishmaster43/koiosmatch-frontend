/**
 * CustomFieldsTab — regression test for the shared "Extra" drawer tab (§3A(f)):
 * it must render NOTHING when the entity has no active custom-field defs (the
 * drawer itself also gates the tab out of the tab list — this is the belt-and-
 * braces check inside the component), and render the current values once defs exist.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      fields: [{ key: 'budget', label: 'Budget', type: 'number', sort_order: 0, active: true, has_data: false }],
      allFields: [],
      loading: false,
      invalidate: vi.fn(),
    })
    render(<CustomFieldsTab entityType="task" values={{ budget: 500 }} onSave={vi.fn()} />)
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })
})
