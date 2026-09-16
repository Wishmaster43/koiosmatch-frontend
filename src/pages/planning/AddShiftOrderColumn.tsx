// Extracted from AddShiftModal (SIZE-SPLIT-B): the left column — order/customer/
// department pickers. D8 fix (2026-09): the free-text assignment/contact fields,
// the address textarea and the colour swatches used to render here with no
// state/onChange/payload destination at all (NO-FAKE-AFFORDANCE, §3) — dropped
// rather than wired, since none of them map onto a PlanningShiftController field
// (location/colour are derived server-side from the order/open-spot signal).
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import { Field } from './AddShiftModalFields'
import type { ShiftLookupOption } from './hooks/useShiftLookups'
import type { PlanningOrderRow } from './hooks/usePlanningOrders'

// Loose translate-function shape (avoids pulling in i18next's full generic TFunction).
type TFunction = (key: string, opts?: Record<string, unknown>) => string

export default function AddShiftOrderColumn({
  t, orderId, handleOrderChange, orders, ordersLoading, ordersError,
  customerId, handleCustomerChange, customers, customersLoading, customersError,
  departmentId, setDepartmentId, departments, departmentsLoading, departmentsError, departmentCustomerId,
}: {
  t: TFunction; orderId: string; handleOrderChange: (id: string) => void
  orders: PlanningOrderRow[]; ordersLoading: boolean; ordersError: boolean
  customerId: string; handleCustomerChange: (id: string) => void
  customers: ShiftLookupOption[]; customersLoading: boolean; customersError: boolean
  departmentId: string; setDepartmentId: (id: string) => void
  departments: ShiftLookupOption[]; departmentsLoading: boolean; departmentsError: boolean; departmentCustomerId: string
}) {
  return (
    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
      background: 'var(--surface)', overflowY: 'auto', padding: '14px 14px',
      display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={cardHead}>{t('sectionOrder')}</div>
        <div style={cardBox}>
          <Field label={t('order.listTitle')}>
            <CreatableSelect value={orderId || null} onChange={handleOrderChange} allowCreate={false}
              clearable clearLabel={t('order.noOrder')}
              placeholder={ordersLoading ? t('common:loading') : ordersError ? t('common:errorGeneric') : orders.length === 0 ? t('common:noResults') : t('common:select')}
              options={orders.map(o => ({ value: String(o.id), label: o.subject || o.function || o.reference || o.client || t('order.listTitle') }))} />
          </Field>
          <Field label={t('fCustomer')}>
            <CreatableSelect value={customerId || null} onChange={handleCustomerChange} allowCreate={false}
              placeholder={customersLoading ? t('common:loading')
                : customersError ? t('common:errorGeneric')
                : customers.length === 0 ? t('common:noResults')
                : t('common:select')}
              options={customers.map(c => ({ value: String(c.id), label: c.name }))} />
          </Field>
          <Field label={t('fDepartment')}>
            {/* Options stay empty until a customer is known — either picked
                directly, or derived from the selected order's own customer
                (departmentCustomerId above) — nothing selectable, not just
                visually greyed. */}
            <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
              placeholder={!departmentCustomerId ? t('pickCustomerFirst')
                : departmentsLoading ? t('common:loading')
                : departmentsError ? t('common:errorGeneric')
                : departments.length === 0 ? t('common:noResults')
                : t('common:select')}
              options={!departmentCustomerId ? [] : departments.map(d => ({ value: String(d.id), label: d.name }))} />
          </Field>
        </div>
      </div>
    </div>
  )
}
