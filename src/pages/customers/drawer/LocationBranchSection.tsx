/**
 * LocationBranchSection — which of the tenant's own branches a customer LOCATION works
 * under. Two states, and telling them apart is the whole point:
 *
 *  · INHERITED (no own couplings) — the site follows the customer. Nothing is copied down,
 *    so changing the customer's branches keeps changing this site too. Shown as the
 *    customer's branches in a muted, non-removable form with a "follows the customer" note.
 *  · DEVIATING (one or more of its own) — someone deliberately gave this site its own set.
 *    Shown as removable chips; removing the last one returns it to inheriting.
 *
 * Backend contract (LOCATIE-VESTIGING-1, measured 28-07): the location PATCH takes
 * `branch_ids`. An EMPTY ARRAY clears the deviation — that is the ONLY way back to
 * inheriting — so it is sent as [], never omitted. `branch_inherited` and
 * `effective_branches` are derived server-side for display and are never written.
 *
 * Layout mirrors the shared BranchSection ("+ Vestiging"): label left, link trigger right,
 * chips in a card below.
 */
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import type { Id } from '@/types/common'

interface Props {
  branchIds: Id[]
  branches: { id: Id; name: string }[]
  inherited: boolean
  effectiveBranches: { id: Id; name: string }[]
  options: { value: string; label: string }[]
  onChange: (branchIds: Id[]) => void
}

export default function LocationBranchSection({ branchIds, branches, inherited, effectiveBranches, options, onChange }: Props) {
  const { t } = useTranslation('customers')
  const selected = branchIds.map(String)

  // Picking toggles membership. Removing the LAST own branch sends [] — which is what
  // hands the site back to the customer, rather than leaving it with none.
  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
    onChange(next)
  }

  const shown = inherited ? effectiveBranches : branches

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <div style={cardHead}>{t('locations.detail.branchTitle')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* State badge: which of the two situations you are looking at, in words —
              never colour alone (§6). */}
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap',
            color: inherited ? 'var(--text-muted)' : 'var(--color-primary)',
            background: inherited ? 'var(--bg)' : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            border: `1px solid ${inherited ? 'var(--border)' : 'color-mix(in srgb, var(--color-primary) 35%, transparent)'}` }}>
            {inherited ? t('locations.detail.branchInherited') : t('locations.detail.branchOwn')}
          </span>
          <SearchSelect triggerLabel={t('locations.detail.branchLink')} options={options} selected={selected}
            onToggle={toggle} menuAlign="right"
            renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={t('locations.detail.branchLink')} />} />
        </div>
      </div>
      <div style={cardBox}>
        {shown.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shown.map(b => (
              <span key={String(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)',
                color: inherited ? 'var(--text-muted)' : 'var(--text)' }}>
                {b.name}
                {/* Only an OWN coupling can be removed here — an inherited one belongs to
                    the customer, and removing it there is a different decision. */}
                {!inherited && (
                  <button onClick={() => toggle(String(b.id))} aria-label={t('common:remove')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('locations.detail.branchEmpty')}</span>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>{t('locations.detail.branchHint')}</p>
      </div>
    </div>
  )
}
