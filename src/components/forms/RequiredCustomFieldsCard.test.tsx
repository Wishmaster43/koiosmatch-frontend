/**
 * RequiredCustomFieldsCard — ONIX N-005: the create-modal card that renders a
 * tenant's REQUIRED custom fields (and nothing else), with the 422 red-border
 * flag + server message attached by the dotted bag key.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// #18 (§6): a required rich-text field is named by its row label and announced as required.
describe('RequiredCustomFieldsCard · rich-text field a11y', () => {
  it('associates the label with the editable root and marks it required', async () => {
    mockedUseCustomFields.mockReturnValue({
      fields: [{ key: 'story', label: 'Story', type: 'textarea', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }],
      allFields: [], loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn(),
    })
    render(<RequiredCustomFieldsCard entityType="candidate" values={{}} onChange={vi.fn()} />)
    const root = await waitFor(() => {
      const el = document.querySelector('[contenteditable="true"]') as HTMLElement
      expect(el).not.toBeNull()
      return el
    })
    expect(root).toHaveAttribute('aria-required', 'true')
    const labelId = root.getAttribute('aria-labelledby') as string
    expect(document.getElementById(labelId)).toHaveTextContent('Story')
    expect(root.id).toBeTruthy()
  })
})
