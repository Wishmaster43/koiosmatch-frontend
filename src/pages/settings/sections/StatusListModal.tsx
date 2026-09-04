// Extracted from StatusListEditor (SIZE-SPLIT-B, zero behaviour change): the
// create/edit modal form.
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import Button from '@/components/ui/Button'
import ModalFooter from '@/components/ui/ModalFooter'
import { PageTitle, BodyText } from '@/components/ui/typography'
import { ColorSwatch } from '../components/SettingsControls'
import { Toggle } from '../components/SettingsKit'
import IconPickerControl from './IconPickerControl'
import { FALLBACK_SWATCH } from './statusListEditorTypes'
import type { StatusListDraft, StatusListItem, ExtraFieldDef, FlagFieldDef, NumberFieldDef, IconPickerDef } from './statusListEditorTypes'

export default function StatusListModal({
  modalPanelRef, editing, addLabel, draft, setDraft, withColor, resolvedIconPicker, numberField, extraField, flagList,
  saving, onClose, onSubmit,
}: {
  modalPanelRef: RefObject<HTMLDivElement | null>
  editing: StatusListItem | null; addLabel: React.ReactNode
  draft: StatusListDraft; setDraft: (updater: (d: StatusListDraft) => StatusListDraft) => void
  withColor: boolean; resolvedIconPicker: IconPickerDef | null
  numberField: NumberFieldDef | null; extraField: ExtraFieldDef | null; flagList: FlagFieldDef[]
  saving: boolean; onClose: () => void; onSubmit: () => void
}) {
  const { t } = useTranslation('settings')
  return (
    <>
      {/* Backdrop + panel stack on the shared overlay token, never a raw Tailwind z-40/z-50. */}
      <div className="fixed inset-0" style={{ zIndex: 'var(--z-overlay)', background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div ref={modalPanelRef} role="dialog" aria-modal="true" aria-label={editing ? t('statusList.editTitle') : String(addLabel)} tabIndex={-1}
        className="fixed" style={{ zIndex: 'var(--z-overlay)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: '24px 24px 0', width: 400, boxShadow: 'var(--shadow-modal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <PageTitle as="span">{editing ? t('statusList.editTitle') : addLabel}</PageTitle>
          <Button variant="ghost" iconOnly size="sm" onClick={onClose} title={t('common:close')} aria-label={t('common:close')}><X size={16} /></Button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="status-list-name" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.nameLabel')}</label>
          <input id="status-list-name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder={t('statusList.namePlaceholder')} aria-label={t('statusList.nameLabel')}
            style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {withColor && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.colorLabel')}</div>
            <ColorSwatch color={draft.color as string} onChange={(c: string) => setDraft(d => ({ ...d, color: c }))} />
          </div>
        )}
        {resolvedIconPicker && (
          // The bare free-text lucide-key input is retired (silently accepted wrong
          // keys) — the same curated IconPickerControl now backs create/edit too.
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.iconLabel')}</div>
            <IconPickerControl icons={resolvedIconPicker.icons} resolve={resolvedIconPicker.resolve} value={draft.icon as string | undefined}
              color={(draft.color as string) ?? FALLBACK_SWATCH} label={(draft.name as string) || t('statusList.iconLabel')}
              onPick={(icon: string) => setDraft(d => ({ ...d, icon }))} />
          </div>
        )}
        {numberField && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="status-list-number" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{numberField.label}</label>
            <input id="status-list-number" type="number" min={numberField.min ?? 1} max={numberField.max ?? 999} value={(draft[numberField.key] as number | string) ?? ''}
              onChange={e => setDraft(d => ({ ...d, [numberField.key]: e.target.value === '' ? null : Number(e.target.value) }))}
              aria-label={numberField.label}
              style={{ width: 120, height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        {extraField && (
          // The hand-rolled native <select> is replaced by the shared searchable
          // SearchSelect (single-select via closeOnToggle) — extraField's prop API
          // (key/label/options/default) is unchanged.
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{extraField.label}</div>
            <SearchSelect closeOnToggle width={352}
              options={extraField.options}
              selected={[draft[extraField.key] as string]}
              onToggle={value => setDraft(d => ({ ...d, [extraField.key]: value }))}
              triggerLabel={extraField.options.find(o => o.value === draft[extraField.key])?.label ?? extraField.label} />
          </div>
        )}
        {/* One toggle per behaviour flag (flagFields) — independent booleans. */}
        {flagList.map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
            <Toggle checked={Boolean(draft[f.key])} ariaLabel={f.label}
              onChange={v => setDraft(d => ({ ...d, [f.key]: v }))} />
            <span style={{ minWidth: 0 }}>
              <BodyText as="span" style={{ display: 'block', fontWeight: 500 }}>{f.label}</BodyText>
              {f.description && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{f.description}</span>}
            </span>
          </div>
        ))}
        {/* Shared modal footer (§4/HUISSTIJL-1) — spans the panel's full width past the body padding. */}
        <div style={{ margin: '20px -24px 0' }}>
          <ModalFooter onCancel={onClose} onSubmit={onSubmit}
            disabled={saving || !draft.name.trim()} busy={saving}
            cancelLabel={t('common.cancel')} submitLabel={editing ? t('common.save') : t('statusList.addBtn') as string} />
        </div>
      </div>
    </>
  )
}
