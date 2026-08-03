/**
 * CustomerBranchesCard — the "Vestigingen" card of AddCustomerModal: one
 * establishment (own /locations, BRANCH-1) with an add trigger and a removable
 * chip, plus the sentence explaining that leaving it empty is a real, useful
 * choice. Extracted (§0.3 — the ~400-line split trigger, 2026-08-03); pure
 * presentational, every value and callback comes from the parent's own form
 * state.
 */
import { useTranslation } from 'react-i18next'
import type { CustomerForm } from '../AddCustomerModal'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface OptionRow { value: string; label: string }

interface CustomerBranchesCardProps {
  form: CustomerForm
  set: (k: keyof CustomerForm, v: string) => void
  branchOptions: OptionRow[]
}

export default function CustomerBranchesCard({ form, set, branchOptions }: CustomerBranchesCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      {/* Exactly as the candidate modal does it: the heading with its own add
          trigger on the right, chips below, and the sentence saying what
          LEAVING IT EMPTY means. That sentence is the point: empty is a real,
          useful choice here, not an unfinished field. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <div style={{ ...cardHead, marginBottom: 0 }}>{t('overview.branch')}</div>
        <SearchSelect triggerLabel={t('modal.fields.branchAdd')} options={branchOptions}
          selected={form.branchId ? [form.branchId] : []}
          onToggle={(id: string) => set('branchId', form.branchId === id ? '' : id)}
          menuAlign="right"
          renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={t('modal.fields.branchAdd')} />} />
      </div>
      <div style={cardBox}>
        {form.branchId ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
              borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
              {branchOptions.find(o => String(o.value) === form.branchId)?.label ?? form.branchId}
              <button type="button" onClick={() => set('branchId', '')} aria-label={t('common:remove')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{t('modal.fields.branchAutoHint')}</p>
        )}
      </div>
    </div>
  )
}
