/**
 * profileFieldShared — presentational atoms shared by the three Profile
 * sub-tabs (Personal / Address / Contact, Danny 28-07 split). Each sub-tab
 * owns its OWN field set + edit state (so one pencil never flips more than a
 * handful of fields, §3 size discipline) but they all render the same
 * label/value row shape and the same pencil→save/cancel control — kept here
 * once so the three tabs don't each hand-roll a slightly different copy.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
// HUISSTIJL-1: the shared uppercase group-label atom (identity-only swap).
import { GroupLabel } from '@/components/ui/typography'

// Shared input styling for text/date/combobox controls across all three tabs
// (G33/fieldMetrics canon — was its own padding-7/font-12/radius-6 copy).
// eslint-disable-next-line react-refresh/only-export-components -- a style constant re-export alongside this file's components; HMR-nicety warning only
export const inputStyle: CSSProperties = fieldInputStyle

const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

// Bordered card holding one group's field rows. The group NAME is not in here — it sits
// on the header row above the card, next to the pencil, exactly like the profile-text
// block does (Danny 28-07: "kopjes horen er buiten te staan, kijk maar naar profiel
// txt", i.e. "headings belong outside it, just look at the profile text"). See
// GroupHeader below; one heading convention for the whole tab.
export function GroupCard({ children }: { children: ReactNode }) {
  return <div style={{ ...blockStyle, padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
}

// The row above a card: group title on the left, its own pencil/save/cancel on the
// right — the same shape the profile-text block already uses.
export function GroupHeader({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      {/* HUISSTIJL-1: identical 11/600/uppercase render, letterSpacing kept at
          this block's own 0.04em (atom default is 0.05em) via the style override. */}
      <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{title}</GroupLabel>
      {children}
    </div>
  )
}

// One labelled field row: label-left (with optional required marker/icon),
// value-or-input right, optional error line below. Read vs. edit content is
// decided by the caller (children), since what renders differs per field type.
export function FieldRow({ label, required, errorText, labelIcon, children }: {
  label: ReactNode; required?: boolean; errorText?: ReactNode; labelIcon?: ReactNode; children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      {/* Canon width/color/size (fieldRowCanon) + the flex/gap this row alone needs to seat an optional labelIcon next to the label text. */}
      <span style={{ ...CANON_LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 5 }}>
        {labelIcon}
        {label}{required && <span style={{ color: 'var(--color-danger-text)' }}> *</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
        {errorText && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{errorText}</div>}
      </div>
    </div>
  )
}

// Pencil → save/cancel toggle, identical look across all three sub-tabs.
export function EditControls({ editing, onSave, onCancel, onStart }: {
  editing: boolean; onSave: () => void; onCancel: () => void; onStart: () => void
}) {
  const { t } = useTranslation('candidates')
  if (!editing) return (
    <Button variant="secondary" size="sm" iconOnly onClick={onStart} title={t('common:edit')} aria-label={t('common:edit')}>
      <Edit2 size={13} />
    </Button>
  )
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <Button variant="primary" size="sm" iconOnly onClick={onSave} title={t('common:save')} aria-label={t('common:save')}>
        <Save size={13} />
      </Button>
      <Button variant="secondary" size="sm" iconOnly onClick={onCancel} title={t('common:cancel')} aria-label={t('common:cancel')}>
        <X size={13} />
      </Button>
    </div>
  )
}
