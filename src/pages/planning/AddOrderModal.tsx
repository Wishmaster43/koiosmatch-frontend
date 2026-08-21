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
import { tintBorder } from '@/lib/tint'
import { useCustomerCascade } from '@/hooks/useCustomerCascade'
import { useShiftCustomers } from './hooks/useShiftLookups'
import { useFunctions } from '@/lib/useFunctions'
import { useUsers } from '@/lib/queries'
import { useCreatePlanningOrder, useUpdatePlanningOrder } from './hooks/usePlanningOrders'
import type { PlanningOrderInput, PlanningOrderRow } from './hooks/usePlanningOrders'
import { extractApiError } from '@/lib/extractApiError'
import Button from '@/components/ui/Button'
import DictationTextarea from '@/components/forms/DictationTextarea'

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

// Edit mode seeds the form from the existing row (all ids stringified — the form
// state is string-keyed throughout, same convention as the create path).
function formFromOrder(order: PlanningOrderRow): OrderForm {
  return {
    customerId: order.customer_id != null ? String(order.customer_id) : '',
    locationId: order.customer_location_id != null ? String(order.customer_location_id) : '',
    departmentId: order.customer_department_id != null ? String(order.customer_department_id) : '',
    ownerId: order.owner_id != null ? String(order.owner_id) : '',
    functionName: order.function ?? '',
    reference: order.reference ?? '',
    subject: order.subject ?? '',
    description: order.description ?? '',
    costCenter: order.cost_center ?? '',
    status: order.status,
    notes: order.notes ?? '',
  }
}

export default function AddOrderModal({ onClose, onCreated, order }: { onClose: () => void; onCreated?: () => void; order?: PlanningOrderRow }) {
  const { t } = useTranslation(['planning', 'common'])
  const [form, setForm] = useState<OrderForm>(() => order ? formFromOrder(order) : EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const { customers, loading: customersLoading, error: customersError } = useShiftCustomers()
  const { locations } = useCustomerCascade(form.customerId)
  const { functions } = useFunctions()
  const { data: users } = useUsers()
  const create = useCreatePlanningOrder()
  const update = useUpdatePlanningOrder()
  const isEditing = Boolean(order)
  const saving = create.isPending || update.isPending

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
      if (isEditing && order) {
        await update.mutateAsync({ id: order.id, body })
      } else {
        await create.mutateAsync(body)
      }
      onCreated?.()
      onClose()
    } catch (err) {
      setError(extractApiError(err, t('common:errorGeneric')))
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
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {isEditing ? t('order.modal.editTitle') : t('order.modal.title')}
            </div>
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
                {/* POP-UPS 4: omschrijving krijgt de house-mic (plain-text dictatie). */}
                <DictationTextarea value={form.description} rows={2} style={{ resize: 'none' }}
                  onChange={v => set('description', v)} aria-label={t('order.fDescription')} />
              </FieldRow>
              <FieldRow label={t('notes')}>
                <DictationTextarea value={form.notes} rows={2} style={{ resize: 'none' }}
                  onChange={v => set('notes', v)} aria-label={t('notes')} />
              </FieldRow>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ margin: '0 24px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
          color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
          border: tintBorder('var(--color-danger)', true), flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onClose}>
          {t('common:cancel')}
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? t('common:saving') : isEditing ? t('common:save') : t('order.modal.create')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
