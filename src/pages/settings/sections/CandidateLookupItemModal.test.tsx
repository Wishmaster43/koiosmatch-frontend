import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CandidateLookupItemModal, { type LookupModalState } from './CandidateLookupItemModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts && 'max' in opts ? `${k}:${opts.max}` : k) }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('@/components/ui/FloatingPanel', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

const modal = { mode: 'add', value: '', label: '', color: '#000', icon: null } as unknown as LookupModalState

// LOOKUP-VALUE-MAX-1 (Danny 19-09): the backend caps a lookup value at 50 characters; the input
// stops there and the hint carries the number, so the server's own 422 never has to appear.
describe('CandidateLookupItemModal · value length cap', () => {
  it('caps the value input at 50 characters and says so in the hint', () => {
    render(<CandidateLookupItemModal modal={modal} setModal={vi.fn()} onClose={vi.fn()} onSave={vi.fn()} busy={false}
      isStatusBlock={false} isFunnelBlock={false} isPhaseBlock={false} isContractFormBlock={false} supportsIcon={false} />)
    const value = screen.getByPlaceholderText('slug')
    expect(value).toHaveAttribute('maxlength', '50')
    expect(screen.getByText('lookups.valueHint:50')).toBeInTheDocument()
  })
})
