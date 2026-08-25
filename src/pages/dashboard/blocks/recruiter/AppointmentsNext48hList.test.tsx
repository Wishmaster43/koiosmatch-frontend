/**
 * AppointmentsNext48hList — resolves the appointment type through the tenant
 * lookup (never the raw slug) and navigates to the application or candidate.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AppointmentsNext48hList from './AppointmentsNext48hList'
import type { AppointmentNext48hRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: () => '25-08 14:00' }) }))
vi.mock('@/lib/useAppointmentTypes', () => ({
  useAppointmentTypes: () => ({ metaOf: (v: string) => (v === 'intake_flex' ? { value: v, label: 'Intake Flex' } : undefined) }),
}))

const rowWithApp: AppointmentNext48hRow = {
  appointment_id: 'a1', candidate_id: 'c1', candidate: { id: 'c1', name: 'Bob' },
  scheduled_at: '2026-08-25T14:00:00Z', type: 'intake_flex', application_id: 'app1',
}
const rowWithoutApp: AppointmentNext48hRow = { ...rowWithApp, appointment_id: 'a2', application_id: null, type: 'unknown_slug' }

describe('AppointmentsNext48hList', () => {
  it('self-hides on an empty feed', () => {
    const { container } = render(<AppointmentsNext48hList rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('resolves the type label and navigates to the application when present', () => {
    const onNavigate = vi.fn()
    render(<AppointmentsNext48hList rows={[rowWithApp]} onNavigate={onNavigate} />)
    expect(screen.getByText('Intake Flex')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bob'))
    expect(onNavigate).toHaveBeenCalledWith('applications', { open: 'app1' })
  })

  it('omits an unresolved type slug and navigates to the candidate without an application', () => {
    const onNavigate = vi.fn()
    render(<AppointmentsNext48hList rows={[rowWithoutApp]} onNavigate={onNavigate} />)
    expect(screen.queryByText('unknown_slug')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Bob'))
    expect(onNavigate).toHaveBeenCalledWith('candidates', { open: 'c1' })
  })
})
