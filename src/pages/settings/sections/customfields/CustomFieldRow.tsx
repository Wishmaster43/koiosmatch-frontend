import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Eye, EyeOff, Monitor, MonitorOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Caption, SectionTitle, Mono } from '@/components/ui/typography'
import type { CustomField, EditForm } from './types'
import CustomFieldEditForm from './CustomFieldEditForm'
import { cardStyle } from './customFieldStyles'

// Props: one field with its edit draft, plus per-row action callbacks bound by the container.
interface CustomFieldRowProps {
  field: CustomField
  isOpen: boolean
  ef: EditForm
  saving: boolean
  onToggleActive: () => void
  onToggleVisible: () => void
  onToggleOpen: () => void
  onClose: () => void
  onEdit: (k: keyof EditForm, v: EditForm[keyof EditForm]) => void
  onSave: () => void
  onDelete: () => void
}

// One draggable field card: summary row with toggles plus the expandable edit form.
export default function CustomFieldRow({
  field, isOpen, ef, saving, onToggleActive, onToggleVisible, onToggleOpen, onClose, onEdit, onSave, onDelete,
}: CustomFieldRowProps) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 0, marginBottom: 0, opacity: field.active ? 1 : 0.6 }}>
      {/* Row summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Label + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionTitle as="div">{field.label}</SectionTitle>
          <Caption as="div">
            <Mono as="code">{field.key}</Mono>
            {' · '}{t(`customFieldsSettings.types.${field.type}`)}
            {field.has_data && <span style={{ color: 'var(--color-warning-text)', marginLeft: 6 }}>· {t('customFieldsSettings.hasData')}</span>}
            {/* Worklist #44: legible in words, not just icon colour — a tenant
                must understand WHY a field they configured isn't showing up. */}
            {!field.visible_in_ui && <span style={{ color: 'var(--color-info)', marginLeft: 6 }}>· {t('customFieldsSettings.apiOnly')}</span>}
          </Caption>
        </div>

        {/* Active toggle */}
        <Button variant="ghost" iconOnly onClick={() => onToggleActive()} title={field.active ? t('customFieldsSettings.deactivate') : t('customFieldsSettings.activate')}
          aria-label={field.active ? t('customFieldsSettings.deactivate') : t('customFieldsSettings.activate')}
          style={{ color: field.active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          {field.active ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>

        {/* Visible-in-UI toggle (worklist #44) — independent of active: the field
            stays reachable via the API/imports either way, this only hides it from
            the entity's rendered Extra tab. Monitor/MonitorOff so it reads as a
            distinct control from the Eye/EyeOff active toggle above. */}
        <Button variant="ghost" iconOnly onClick={() => onToggleVisible()} title={field.visible_in_ui ? t('customFieldsSettings.hideFromUi') : t('customFieldsSettings.showInUi')}
          aria-label={field.visible_in_ui ? t('customFieldsSettings.hideFromUi') : t('customFieldsSettings.showInUi')}
          style={{ color: field.visible_in_ui ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          {field.visible_in_ui ? <Monitor size={14} /> : <MonitorOff size={14} />}
        </Button>

        {/* Expand / collapse */}
        <Button variant="ghost" iconOnly onClick={() => onToggleOpen()}
          aria-label={isOpen ? t('common:collapse') : t('common:expand')}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>

      {/* Expanded edit form */}
      {isOpen && (
        <CustomFieldEditForm field={field} ef={ef} saving={saving} onEdit={onEdit} onSave={onSave} onDelete={onDelete} onClose={onClose} />
      )}
    </div>
  )
}
