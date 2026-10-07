/**
 * PendingUploadQueue — N008-DOC-EXPIRY-FE-1 coverage: the expiry date field
 * renders only for a requiresExpiry type, is required only when that type has
 * no default validity, and the footer's Add button stays disabled while a
 * required-and-empty row exists.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PendingUploadQueue from './PendingUploadQueue'
import type { PendingItem } from './PendingUploadQueue'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }) }))

const docTypes = [
  { value: 'CV', label: 'CV' },
  { value: 'VOG', label: 'VOG', requiresExpiry: true, defaultValidityMonths: null },
  { value: 'Diploma', label: 'Diploma', requiresExpiry: true, defaultValidityMonths: 12 },
]

const baseProps = {
  docTypes,
  educations: [], certifications: [], languages: [], skills: [], references: [],
  onSetType: vi.fn(), onSetAllTypes: vi.fn(), onSetLink: vi.fn(),
  onRemove: vi.fn(), onUploadAll: vi.fn(), onCancel: vi.fn(),
}

const item = (over: Partial<PendingItem>): PendingItem => ({
  file: new File(['x'], 'f.pdf'), objectUrl: 'blob:a', name: 'f.pdf', size: '1 KB', type: 'CV', linkTo: '', ...over,
})

describe('PendingUploadQueue · expiry field (N008-DOC-EXPIRY-FE-1)', () => {
  it('renders no date field for a type that does not require an expiry', () => {
    render(<PendingUploadQueue {...baseProps} pending={[item({ type: 'CV' })]} onSetExpiry={vi.fn()} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders a required date field (no default validity) and keeps Add disabled while empty', () => {
    render(<PendingUploadQueue {...baseProps} pending={[item({ type: 'VOG' })]} onSetExpiry={vi.fn()} />)
    const field = screen.getByRole('textbox')
    // react-datepicker's customInput drops a plain `required` DOM attribute —
    // `aria-required` is the one it forwards (measured), so that is what we assert.
    expect(field).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('button', { name: /common:add/ })).toBeDisabled()
  })

  // 07-10 fix: the star is decorative — aria-required on the field is the real
  // signal a screen reader must announce, never "star".
  it('marks the required star aria-hidden while the field keeps aria-required', () => {
    render(<PendingUploadQueue {...baseProps} pending={[item({ type: 'VOG' })]} onSetExpiry={vi.fn()} />)
    const field = screen.getByRole('textbox')
    expect(field).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders an optional date field with the default-validity caption when the type has one', () => {
    render(<PendingUploadQueue {...baseProps} pending={[item({ type: 'Diploma' })]} onSetExpiry={vi.fn()} />)
    const field = screen.getByRole('textbox')
    expect(field).not.toHaveAttribute('aria-required')
    expect(screen.getByText(/documents\.expiryDefault/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /common:add/ })).not.toBeDisabled()
  })

  it('enables Add once the required expiry is filled in', async () => {
    const user = userEvent.setup()
    const onSetExpiry = vi.fn()
    const { rerender } = render(<PendingUploadQueue {...baseProps} pending={[item({ type: 'VOG' })]} onSetExpiry={onSetExpiry} />)
    const field = screen.getByRole('textbox')
    await user.type(field, '12/31/2027')
    expect(onSetExpiry).toHaveBeenCalled()
    // Simulate the parent applying the picked date back into the queued item.
    rerender(<PendingUploadQueue {...baseProps} pending={[item({ type: 'VOG', expiresAt: '2027-12-31' })]} onSetExpiry={onSetExpiry} />)
    expect(screen.getByRole('button', { name: /common:add/ })).not.toBeDisabled()
  })
})
