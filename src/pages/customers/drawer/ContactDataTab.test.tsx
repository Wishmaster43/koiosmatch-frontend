import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactDataTab from './ContactDataTab'
import type { Contact } from '@/types/customer'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))
vi.mock('@/components/forms/EditableFieldTable', () => ({ default: () => null }))
vi.mock('./ContactTextSection', () => ({ default: () => null }))
vi.mock('@/components/drawer/RetentionConsentBlock', () => ({ default: () => null }))
vi.mock('./ContactLinkSection', () => ({ default: () => null }))

describe('ContactDataTab channel consent lines', () => {
  it('renders three read-only state lines and no switch', () => {
    const contact = { id: 'c1', customerId: 'k1', whatsappConsentState: 'granted', whatsappConsentAt: '2026-01-01', emailConsentState: 'refused', newsletterConsentState: 'not_asked' } as unknown as Contact
    render(<ContactDataTab contact={contact} tableEpoch={0} fields={[]} values={{}} onSaveFields={vi.fn()} editing={false}
      onStartEdit={vi.fn()} onCancel={vi.fn()} onSaveDescription={vi.fn()} onToggleRetentionConsent={vi.fn()}
      locations={[]} departments={[]} linkedLocationIds={[]} linkedDepartmentIds={[]} onLinkChange={vi.fn()}
      t={(k: string) => k} />)
    expect(screen.getByText('consentState.grantedAt')).toBeTruthy()
    expect(screen.getByText('consentState.refused')).toBeTruthy()
    expect(screen.getByText('consentState.notAsked')).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('renders no consent block when the server sent no state for any channel', () => {
    const contact = { id: 'c2', customerId: 'k1', whatsappConsentState: null, emailConsentState: null, newsletterConsentState: null } as unknown as Contact
    render(<ContactDataTab contact={contact} tableEpoch={0} fields={[]} values={{}} onSaveFields={vi.fn()} editing={false}
      onStartEdit={vi.fn()} onCancel={vi.fn()} onSaveDescription={vi.fn()} onToggleRetentionConsent={vi.fn()}
      locations={[]} departments={[]} linkedLocationIds={[]} linkedDepartmentIds={[]} onLinkChange={vi.fn()}
      t={(k: string) => k} />)
    expect(screen.queryByText('communication.consentWhatsapp')).toBeNull()
    expect(screen.queryByText('consentState.title')).toBeNull()
  })
})
