/**
 * ReferencesTab — third-party references (referees) on the candidate's
 * Achtergrond sub-tab bar (KAND-REFERENTIES-1). Mirrors CertificationsTab's
 * anatomy in SectionTabs.tsx exactly (AddableSection + a compact read row,
 * same add/edit/remove affordances) minus the document-link icons — a
 * candidate_reference row carries no document relation — plus one extra
 * per-row action: a subtle "verify" button that stamps the reference as
 * confirmed via POST /candidates/{id}/references/{item}/verify (BackgroundTab
 * wires the actual request; this component only renders the affordance and
 * calls the handler it is given).
 */
import { useTranslation } from 'react-i18next'
import type { ComponentType } from 'react'
import { BadgeCheck } from 'lucide-react'
import AddableSectionJs from '@/components/forms/AddableSection'
import SafeHtml from '@/components/ui/SafeHtml'
import SoftChip from '@/components/ui/SoftChip'
import DrawerAddButton from './DrawerAddButton'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
// AddableSection is still untyped JS — accept any props at this boundary (mirrors SectionTabs.tsx).
const AddableSection = AddableSectionJs as unknown as ComponentType<AnyProps>

// Same short "+ Toevoegen" trigger every Achtergrond sub-tab uses (DRAWER-ADD-SHORT-1).
const renderAddButton = (onClick: () => void) => <DrawerAddButton onClick={onClick} short />

// Relation items vary at the prop boundary — kept loose like every other SectionTabs item.
export type RelItem = Record<string, unknown>

interface ReferencesTabProps {
  items?: RelItem[]
  onAdd?: (v: RelItem) => void
  onEdit?: (i: number, v: RelItem) => void
  onRemove?: (i: number) => void
  // The one action beyond generic CRUD. Omitted or the row not yet persisted →
  // no verify affordance at all (no fake button with nothing real behind it).
  onVerify?: (i: number) => void
}

// A row is persisted once it carries a real backend id (a non-empty UUID string,
// never the negative temp id a fresh add gets before its POST resolves) — mirrors
// BackgroundTab's own isPersisted guard so the verify action never targets a row
// the server has never heard of.
const isPersisted = (id: unknown): id is string | number =>
  (typeof id === 'string' && id.length > 0) || (typeof id === 'number' && id > 0)

/** Read-only prose line for the note field — the shared house rule (§3A): every
 * free-text field renders through SafeHtml, never a bare textarea in read mode. */
function NoteField({ value }: { value?: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      {value
        ? <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }} />
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
    </div>
  )
}

export default function ReferencesTab({ items = [], onAdd, onEdit, onRemove, onVerify }: ReferencesTabProps) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Compact layout: name+relation and employer+phone each pair onto one row;
  // email stands alone; note renders as a rich-text block (one pencil per entry,
  // mirroring the desc field on every other Achtergrond sub-tab).
  const fields = [
    { key: 'name',     label: t('addFields.referenceName', { defaultValue: 'Naam' }), half: true },
    { key: 'relation', label: t('addFields.relation', { defaultValue: 'Relatie' }), half: true },
    { key: 'employer', label: t('addFields.employer', { defaultValue: 'Werkgever' }), half: true },
    { key: 'phone',    label: t('addFields.phone', { defaultValue: 'Telefoon' }), half: true },
    { key: 'email',    label: t('addFields.email', { defaultValue: 'E-mailadres' }) },
    { key: 'note',     label: t('addFields.note', { defaultValue: 'Notitie' }), richtext: true },
  ]
  return (
    <AddableSection title={null} emptyText={t('sections.referencesEmpty', { defaultValue: 'Nog geen referenties.' })}
      renderAddButton={renderAddButton} items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const r = raw as {
          id?: Id; name?: string; relation?: string; employer?: string; phone?: string; email?: string
          note?: string; verified_at?: string | null; verifiedAt?: string | null
        }
        const secondary = [r.relation, r.employer].filter(Boolean).join(' · ')
        const contact = [r.phone, r.email].filter(Boolean).join(' · ')
        const verifiedAt = r.verifiedAt ?? r.verified_at ?? null
        return (
          <div key={r.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
              {secondary && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{secondary}</div>}
              {contact && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact}</div>}
              <NoteField value={r.note} />
              {/* Verified badge once the server has stamped it, else the verify action —
                  never both, and no action at all for an unpersisted (temp id) row. */}
              <div style={{ marginTop: 6 }}>
                {verifiedAt ? (
                  <SoftChip color="var(--color-success)" label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <BadgeCheck size={12} />
                      {t('references.verified', { defaultValue: 'Geverifieerd' })} · {formatDate(verifiedAt)}
                    </span>
                  } />
                ) : (onVerify && isPersisted(r.id)) ? (
                  <button type="button" onClick={() => onVerify(i)}
                    title={t('references.verify', { defaultValue: 'Verifiëren' })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none',
                      border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11,
                      color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <BadgeCheck size={12} />
                    {t('references.verify', { defaultValue: 'Verifiëren' })}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )
      }} />
  )
}
