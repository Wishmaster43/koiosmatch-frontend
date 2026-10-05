/**
 * RequiredCustomFieldsCard — ONIX N-005: the create-modal card that renders a
 * tenant's REQUIRED custom fields (and nothing else), with the 422 red-border
 * flag + server message attached by the dotted bag key.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import RequiredCustomFieldsCard from './RequiredCustomFieldsCard'
import { useCustomFields } from '@/lib/useCustomFields'

vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: vi.fn() }))
const mockedUseCustomFields = vi.mocked(useCustomFields)

afterEach(() => vi.clearAllMocks())

describe('RequiredCustomFieldsCard', () => {
  it('renders null when no def is required', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'notes', label: 'Notes', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: false, required_for: [] }],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    const { container } = render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders only the required def, with an asterisk', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [
        { key: 'notes', label: 'Notes', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: false, required_for: [] },
        { key: 'vog', label: 'VOG', type: 'text', sort_order: 1, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] },
      ],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={vi.fn()} />)
    expect(screen.getByText('VOG')).toBeInTheDocument()
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('renders required_for (phase-required) defs too, not only required_always', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'contract', label: 'Contract', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: false, required_for: ['hired'] }],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={vi.fn()} />)
    expect(screen.getByText('Contract')).toBeInTheDocument()
  })

  it('shows the red-border flag + the translated notice when the server sent the raw "field is required" template', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'vog', label: 'VOG', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={vi.fn()}
      errors={{ 'custom_fields.vog': true }} messages={{ 'custom_fields.vog': 'The custom_fields.vog field is required.' }} />)
    // The raw Laravel sentence never reaches the user — it is swapped for the translated, named notice.
    expect(screen.queryByText('The custom_fields.vog field is required.')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('VOG')
    // jsdom cannot resolve a `var()` shorthand via toHaveStyle, so assert the raw attribute instead.
    expect(screen.getByRole('textbox', { name: 'VOG' }).getAttribute('style')).toContain('border: 1px solid var(--color-danger)')
  })

  it('passes a non-template server message through unchanged', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'vog', label: 'VOG', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={vi.fn()}
      errors={{ 'custom_fields.vog': true }} messages={{ 'custom_fields.vog': 'VOG certificate has expired.' }} />)
    expect(screen.getByText('VOG certificate has expired.')).toBeInTheDocument()
  })

  it('calls onChange with the def key on edit', () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'vog', label: 'VOG', type: 'text', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    const onChange = vi.fn()
    render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'VOG' })
    fireEvent.change(input, { target: { value: 'yes' } })
    expect(onChange).toHaveBeenCalledWith('vog', 'yes')
  })
})
