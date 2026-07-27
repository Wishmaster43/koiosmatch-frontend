/**
 * PriceAgreementsTab · "+ Prijsafspraak toevoegen" trigger (Danny 27-07: "+
 * Prijsafspraak toevoegen moet ook knopje zijn!!! zoals in kandidaat drill
 * down") — covers only the house-button swap: the bare text link is now the
 * shared DrawerAddButton, same onClick (reveals the add form). PriceAgreementForm
 * is a different file's scope (tenant lookup hooks: useFunctions/useCao) — stood
 * in with a marker exposing onSave/onCancel, mirroring WorkTab.test.tsx's pattern.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceAgreementsTab from './PriceAgreementsTab'
import { usePriceAgreements } from '../hooks/usePriceAgreements'

// PriceAgreementRow (rendered per row, unmocked) imports '@/lib/datetime', which
// itself imports '@/i18n' as a side effect — that would boot the REAL i18next
// instance and turn every t() call into translated Dutch instead of the raw key
// this test asserts on (mirrors DocumentsTab.test.tsx's same stand-in).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('../hooks/usePriceAgreements', () => ({ usePriceAgreements: vi.fn() }))
vi.mock('./PriceAgreementForm', () => ({
  default: ({ onSave, onCancel, saveLabel }: { onSave: () => void; onCancel: () => void; saveLabel: string }) => (
    <div data-testid="price-agreement-form">
      <button onClick={onSave}>{saveLabel}</button>
      <button onClick={onCancel}>cancel-form</button>
    </div>
  ),
  emptyDraft: () => ({ functionTitle: '', cao: '', scale: '', step: '', purchaseRate: '', saleRate: '', validFrom: '', validUntil: '', remarks: '' }),
  draftToPayload: (d: unknown) => d,
}))

const baseHook = { agreements: [], loading: false, error: false, reload: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() }

describe('PriceAgreementsTab · "+ Prijsafspraak toevoegen" trigger (Danny 27-07: house button)', () => {
  it('does not render the add form until the trigger is clicked', () => {
    vi.mocked(usePriceAgreements).mockReturnValue(baseHook)
    render(<PriceAgreementsTab customerId="cust-1" />)
    expect(screen.queryByTestId('price-agreement-form')).not.toBeInTheDocument()
  })

  it('opens the add form when the house button is clicked, and submits via the hook\'s add()', async () => {
    const add = vi.fn()
    vi.mocked(usePriceAgreements).mockReturnValue({ ...baseHook, add })
    const user = userEvent.setup()
    render(<PriceAgreementsTab customerId="cust-1" />)
    await user.click(screen.getByRole('button', { name: 'priceAgreements.add' }))
    const form = screen.getByTestId('price-agreement-form')
    expect(form).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'priceAgreements.add' }))
    expect(add).toHaveBeenCalledTimes(1)
  })
})
