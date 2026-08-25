/**
 * LinkCard — the "Koppelingen" card of AddTaskModal: what the task relates to.
 * Pure presentational (Danny 27-07 popup redesign: split out of AddTaskModal.tsx
 * to keep the container under the file-size cap). The assignee picker + read-only
 * creator line moved to their own AssignmentCard/"Toewijzing" (Danny's four-card
 * layout mirroring +Match's Relaties/Contract/Financieel split) — a linked RECORD
 * and WHO owns the task are different concerns.
 *
 * PUNT 15 (Danny 08-08: "een nieuwe taak moet ook aan een bedrijf, locatie,
 * afdeling of contactpersoon kunnen hangen" — "a new task should also be able
 * to attach to a company, location, department or contact"): the three fixed
 * pickers only ever
 * covered candidate/customer/contact, while the DRAWER's LinksTab could couple a
 * task to ten entity types. The rest of that vocabulary is now reachable here
 * through the SAME shared `AddLinkRow` + `taskLinkTypes` the drawer tab uses
 * (§11 one source) — vacancy, match, application, opportunity, location,
 * department and workflow. The three tokens above stay dedicated fields because a
 * host drawer seeds/locks them (`initial`, `lockCustomerId`), so they are
 * EXCLUDED from the adder's type list — one field per coupling, never two truths.
 */
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { FieldRow } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import AddLinkRow from '../links/AddLinkRow'
import type { NewLink } from '../links/AddLinkRow'
import { TASK_LINK_TYPES } from '../links/taskLinkTypes'
import { cardHead, cardBox, pickerStyle, PICKER_MENU_W } from './fields'
import type { TaskForm } from '../AddTaskModal'
import Button from '@/components/ui/Button'
import { Caption, GroupLabel } from '@/components/ui/typography'

interface Opt { value: string; label: string }

// Tokens that already have their own dedicated field above — never offered twice.
const FIELD_TYPES = ['candidate', 'customer', 'contact']
const EXTRA_TYPES = TASK_LINK_TYPES.filter(k => !FIELD_TYPES.includes(k))

export default function LinkCard({ t, form, set, candidates, customers, contacts, optionsLoading, optionsError, onRetryOptions, lockCustomerId, lockCustomerName, extraLinks, onAddExtra, onRemoveExtra }: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
  candidates: Opt[]; customers: Opt[]; contacts: Opt[]
  // Load state of those three lists (§3 four states) — a failed load used to be
  // swallowed and read as "this tenant has no candidates". See useLinkOptions.
  optionsLoading: boolean; optionsError: boolean; onRetryOptions: () => void
  // Set from a customer drawer trigger: the customer field renders read-only
  // instead of a picker (mirrors AddVacancyModal's lockCustomerId).
  lockCustomerId?: string; lockCustomerName?: string
  // The free-vocabulary couplings staged for this create/edit (owned by AddTaskModal).
  extraLinks: NewLink[]
  onAddExtra: (link: NewLink) => void
  onRemoveExtra: (link: { type: string; id: string }) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div style={cardHead}>{t('modal.cardLink')}</div>
      <div style={cardBox}>
        {/* Linked record — candidate/customer/contact, each a searchable
            relational picker (allowCreate=false: a real id, never free-text). */}
        {/* KLANTEN 9-screenshot (21-08): no row2 here — the card already lives
            in a half modal column, so halving it again squeezed the customer
            picker off the screen (same lesson as the postcode row). */}
        <div>
          <FieldRow label={t('modal.candidate')}>
            <CreatableSelect value={form.candidateId || null} onChange={(v: string) => set('candidateId', v)} allowCreate={false}
              placeholder={t('modal.candidatePlaceholder')} style={pickerStyle} menuWidth={PICKER_MENU_W} options={candidates} />
          </FieldRow>
          <FieldRow label={t('modal.customer')}>
            {lockCustomerId
              ? (
                // Read-only: the drawer this modal was opened from already fixes
                // the customer — never a fake picker the recruiter could repoint.
                <div style={{ ...pickerStyle, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)' }}>
                  {lockCustomerName ?? ''}
                </div>
              )
              : (
                <CreatableSelect value={form.customerId || null} onChange={(v: string) => set('customerId', v)} allowCreate={false}
                  placeholder={t('modal.customerPlaceholder')} style={pickerStyle} menuWidth={PICKER_MENU_W} options={customers} />
              )}
          </FieldRow>
        </div>
        <FieldRow label={t('modal.contact')}>
          <CreatableSelect value={form.contactId || null} onChange={(v: string) => set('contactId', v)} allowCreate={false}
            placeholder={t('modal.contactPlaceholder')} style={pickerStyle} menuWidth={PICKER_MENU_W} options={contacts} />
        </FieldRow>

        {/* One honest line for the three pickers above (§3): still loading, or a
            failed fetch with a retry — reusing the shared wording AddLinkRow
            already uses. "Empty" needs no line of its own: an empty picker shows
            CreatableSelect's own "—" row once this line is gone. */}
        {optionsError ? (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-danger-text)' }}>
            <span>{t('links.loadError')}</span>
            <Button type="button" variant="secondary" onClick={onRetryOptions}>{t('common:error.retry')}</Button>
          </div>
        ) : optionsLoading ? (
          <Caption as="div">{t('common:loading')}</Caption>
        ) : null}

        {/* PUNT 15 — the rest of the shared vocabulary (department, location, vacancy,
            …). A real BUTTON opens the picker row, never coloured text (Danny 08-08). */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>
              {t('modal.otherLinks')}
            </GroupLabel>
            {!adding && <DrawerAddButton onClick={() => setAdding(true)} label={t('links.add')} />}
          </div>
          {adding && (
            <AddLinkRow types={EXTRA_TYPES} existing={extraLinks}
              onAdd={onAddExtra} onClose={() => setAdding(false)} />
          )}
          {/* Staged couplings — each removable until the task is saved. */}
          {extraLinks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {extraLinks.map(l => (
                <div key={`${l.type}-${l.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ display: 'flex', flexShrink: 0, color: 'var(--color-primary-text)' }}><Link2 size={13} /></span>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: 'var(--text-muted)', flexShrink: 0 }}>{t(`links.${l.type}`)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label || '—'}</span>
                  <Button type="button" variant="dangerSoft" iconOnly onClick={() => onRemoveExtra({ type: l.type, id: l.id })}
                    title={t('links.remove')} aria-label={t('links.remove')} style={{ flexShrink: 0 }}>
                    <X size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
