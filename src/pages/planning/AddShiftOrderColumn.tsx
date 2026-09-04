// Extracted from AddShiftModal (SIZE-SPLIT-B, zero behaviour change): the left
// column — order/customer/department pickers, location, colour swatches.
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import { Field } from './AddShiftModalFields'
import { INPUT } from './addShiftFieldStyles'
import type { ShiftLookupOption } from './hooks/useShiftLookups'
import type { PlanningOrderRow } from './hooks/usePlanningOrders'

// Loose translate-function shape (avoids pulling in i18next's full generic TFunction).
type TFunction = (key: string, opts?: Record<string, unknown>) => string

export default function AddShiftOrderColumn({
  t, orderId, handleOrderChange, orders, ordersLoading, ordersError,
  customerId, handleCustomerChange, customers, customersLoading, customersError,
  departmentId, setDepartmentId, departments, departmentsLoading, departmentsError, departmentCustomerId,
  address, setAddress, color, setColor, colors,
}: {
  t: TFunction; orderId: string; handleOrderChange: (id: string) => void
  orders: PlanningOrderRow[]; ordersLoading: boolean; ordersError: boolean
  customerId: string; handleCustomerChange: (id: string) => void
  customers: ShiftLookupOption[]; customersLoading: boolean; customersError: boolean
  departmentId: string; setDepartmentId: (id: string) => void
  departments: ShiftLookupOption[]; departmentsLoading: boolean; departmentsError: boolean; departmentCustomerId: string
  address: string; setAddress: (v: string) => void
  color: string; setColor: (c: string) => void; colors: string[]
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
          <Field label={t('fAssignment')}><input style={INPUT} /></Field>
          <Field label={t('fContact')}><input style={INPUT} placeholder={t('contactPlaceholder')} /></Field>
        </div>
      </div>

      <div>
        <div style={cardHead}>{t('sectionLocation')}</div>
        <div style={cardBox}>
          <Field label={t('fAddress')}>
            <textarea style={{ ...INPUT, resize: 'none', height: 56 }}
              value={address} onChange={e => setAddress(e.target.value)} />
          </Field>
        </div>
      </div>

      <div>
        <div style={cardHead}>{t('sectionColor')}</div>
        <div style={cardBox}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* Icon-only swatch buttons need a real aria-label (§6) — the CSS
                value itself isn't meaningful to a screen reader, so number them.
                HUISSTIJL-1: left hand-styled — each swatch's fill IS the picked
                colour value (data), not a Button identity. */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
            {colors.map((c, i) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`${t('sectionColor')} ${i + 1}`}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
            ))}
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          </div>
        </div>
      </div>
    </div>
  )
}
