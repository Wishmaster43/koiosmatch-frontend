/**
 * AddOrderModal — creates a real Planning Order (PLANNING-ORDER-CREATE-1, 2026-08-14).
 *
 * This is the missing first step of the order -> shift -> schedule model: POST
 * /planning/shifts requires an existing planning_order_id, and until now nothing in
 * this app ever created one (AddShiftModal's own Save is disabled with an honest
 * "not connected" notice for exactly that reason — see its file header). Route
 * verified live against koiosmatch-api's PlanningOrderController + FormRequest
 * validation (not the generated spec, which doesn't cover this route's response
 * shape): POST /planning/orders, 201 + PlanningOrderResource.
 *
 * Shape mirrors AddCustomerModal (§3A): FloatingPanel + WIDE_MODAL frame, titled
 * bordered cards (modalCards), label-LEFT fields (FieldRow, the 2026-08-13 canon —
 * supersedes AddShiftModal's own label-above Field, which predates that rule),
 * every picker a searchable CreatableSelect. Customer/location/department cascade
 * via the shared useCustomerCascade (one GET, no bespoke fetch); owner via the
 * shared useUsers (central users, tenant-scoped exactly like every other owner
 * picker); function via the shared useFunctions tenant lookup; status via the
 * PlanningOrder::STATUSES enum surfaced by the backend (open/filled/cancelled —
 * no tenant lookup for this axis yet, so the three fixed values are labelled
 * through i18n, never a bare literal in the option list).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { FieldRow, inputStyle } from '@/components/forms/fields'
import { cardHead, cardBox, modalColumns } from '@/components/ui/modalCards'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { BTN_H } from '@/config/buttonMetrics'
import { useCustomerCascade } from '@/hooks/useCustomerCascade'
import { useShiftCustomers } from './hooks/useShiftLookups'
import { useFunctions } from '@/lib/useFunctions'
import { useUsers } from '@/lib/queries'
import { useCreatePlanningOrder } from './hooks/usePlanningOrders'
import type { PlanningOrderInput } from './hooks/usePlanningOrders'

// The three status values PlanningOrder::STATUSES accepts — a fixed backend enum
// (not yet a tenant lookup), so the values stay literal but every LABEL still runs
// through i18n (never a raw "open"/"filled"/"cancelled" string shown to the user).
const ORDER_STATUSES = ['open', 'filled', 'cancelled'] as const

interface OrderForm {
  customerId: string; locationId: string; departmentId: string; ownerId: string
  functionName: string; reference: string; subject: string; description: string
  costCenter: string; status: string; notes: string
}

const EMPTY_FORM: OrderForm = {
  customerId: '', locationId: '', departmentId: '', ownerId: '',
  functionName: '', reference: '', subject: '', description: '',
  costCenter: '', status: 'open', notes: '',
}

export default function AddOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const { t } = useTranslation(['planning', 'common'])
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const { customers, loading: customersLoading, error: customersError } = useShiftCustomers()
  const { locations } = useCustomerCascade(form.customerId)
  const { functions } = useFunctions()
  const { data: users } = useUsers()
  const create = useCreatePlanningOrder()

  const set = (k: keyof OrderForm, v: string) => { setForm(f => ({ ...f, [k]: v })); setError(null) }
  // A new customer invalidates the previously picked location/department (they
  // belonged to the old customer) — same cascade-reset idiom as AddShiftModal.
  const handleCustomerChange = (id: string) => setForm(f => ({ ...f, customerId: id, locationId: '', departmentId: '' }))
  const handleLocationChange = (id: string) => setForm(f => ({ ...f, locationId: id, departmentId: '' }))

  const pickedLocation = locations.find(l => String(l.id) === form.locationId)
  const departmentOptions = pickedLocation?.departments ?? []

  const handleSubmit = async () => {
    const body: PlanningOrderInput = {
      customer_id: form.customerId || null,
      customer_location_id: form.locationId || null,
      customer_department_id: form.departmentId || null,
      owner_id: form.ownerId || null,
      function: form.functionName || null,
      reference: form.reference || null,
      subject: form.subject || null,
      description: form.description || null,
      cost_center: form.costCenter || null,
      status: form.status,
      notes: form.notes || null,
    }
    try {
      await create.mutateAsync(body)
      onCreated?.()
      onClose()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? t('common:errorGeneric'))
    }
  }

  const userOptions = (users ?? []).map((u) => {
    const row = u as { id: unknown; name?: string }
    return { value: String(row.id), label: row.name ?? '—' }
  })

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={t('order.modal.title')}
      persistKey="planning-order-add" scrollBody={false}
      width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`} maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={16} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('order.modal.title')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('order.modal.subtitle')}</div>
          </div>
        </div>
      }>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={modalColumns('repeat(auto-fit, minmax(340px, 1fr))')}>
          {/* LEFT — who the order is for: customer / location / department. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardBox}>
              <div style={cardHead}>{t('order.sectionCustomer')}</div>
              <FieldRow label={t('fCustomer')}>
                <CreatableSelect value={form.customerId || null} onChange={handleCustomerChange} allowCreate={false}
                  clearable clearLabel={t('order.noCustomer')}
                  placeholder={customersLoading ? t('common:loading') : customersError ? t('common:errorGeneric') : t('common:select')}
                  options={customers.map(c => ({ value: String(c.id), label: c.name }))} />
              </FieldRow>
              <FieldRow label={t('order.fLocation')}>
                <CreatableSelect value={form.locationId || null} onChange={handleLocationChange} allowCreate={false}
                  clearable clearLabel={t('order.noLocation')}
                  placeholder={!form.customerId ? t('pickCustomerFirst') : t('common:select')}
                  options={!form.customerId ? [] : locations.map(l => ({ value: String(l.id), label: l.name ?? '—' }))} />
              </FieldRow>
              <FieldRow label={t('fDepartment')}>
                <CreatableSelect value={form.departmentId || null} onChange={v => set('departmentId', v)} allowCreate={false}
                  clearable clearLabel={t('order.noDepartment')}
                  placeholder={!form.locationId ? t('order.pickLocationFirst') : t('common:select')}
                  options={!form.locationId ? [] : departmentOptions.map(d => ({ value: String(d.id), label: d.name ?? '—' }))} />
              </FieldRow>
              <FieldRow label={t('order.fOwner')}>
                <CreatableSelect value={form.ownerId || null} onChange={v => set('ownerId', v)} allowCreate={false}
                  clearable clearLabel={t('order.noOwner')} placeholder={t('common:select')} options={userOptions} />
              </FieldRow>
            </div>
          </div>

          {/* RIGHT — the order itself: function/reference/subject/status/cost centre. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardBox}>
              <div style={cardHead}>{t('order.sectionOrder')}</div>
              <FieldRow label={t('order.fFunction')}>
                <CreatableSelect value={form.functionName || null} onChange={v => set('functionName', v)}
                  clearable clearLabel={t('order.noFunction')} placeholder={t('common:select')} options={functions} />
              </FieldRow>
              <FieldRow label={t('order.fReference')}>
                <input style={inputStyle} value={form.reference} onChange={e => set('reference', e.target.value)} maxLength={120} />
              </FieldRow>
              <FieldRow label={t('order.fSubject')}>
                <input style={inputStyle} value={form.subject} onChange={e => set('subject', e.target.value)} />
              </FieldRow>
              <FieldRow label={t('order.fStatus')}>
                <CreatableSelect value={form.status} onChange={v => set('status', v)} allowCreate={false}
                  options={ORDER_STATUSES.map(s => ({ value: s, label: t(`order.status.${s}`) }))} />
              </FieldRow>
              <FieldRow label={t('order.fCostCenter')}>
                <input style={inputStyle} value={form.costCenter} onChange={e => set('costCenter', e.target.value)} maxLength={120} />
              </FieldRow>
            </div>
            <div style={cardBox}>
              <div style={cardHead}>{t('notes')}</div>
              <FieldRow label={t('order.fDescription')}>
                <textarea style={{ ...inputStyle, height: 60, resize: 'none' as const }} value={form.description}
                  onChange={e => set('description', e.target.value)} />
              </FieldRow>
              <FieldRow label={t('notes')}>
                <textarea style={{ ...inputStyle, height: 60, resize: 'none' as const }} value={form.notes}
                  onChange={e => set('notes', e.target.value)} />
              </FieldRow>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ margin: '0 24px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
          color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
          border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose}
          style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
          {t('common:cancel')}
        </button>
        <button onClick={handleSubmit} disabled={create.isPending}
          style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
            background: create.isPending ? 'var(--border)' : 'var(--color-primary)',
            color: create.isPending ? 'var(--text-muted)' : 'var(--color-on-accent)',
            cursor: create.isPending ? 'not-allowed' : 'pointer' }}>
          {create.isPending ? t('common:saving') : t('order.modal.create')}
        </button>
      </div>
    </FloatingPanel>
  )
}
