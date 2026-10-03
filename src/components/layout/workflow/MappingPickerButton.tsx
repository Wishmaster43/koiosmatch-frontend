/**
 * MappingPickerButton — the "{ }" mapping affordance on an edge-filter
 * condition's VALUE (FILTER-MAPPING-1, Make's drag-a-field-in: "actief,
 * verwijderd, extern moeten mappingsvelden zijn van de modules ervoor").
 * Reuses VariablePicker's own numbered-groups popover (`PickerPopover`) — the
 * same panel the config-field "{ }" button opens — so there is one picker
 * surface, never a second one. Unlike `TextFieldWithVars` it does not own an
 * input/caret itself: the caller decides what "insert this field" means for
 * its own control (append to text, add a chip, …) via `onInsert`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PickerPopover } from './VariablePicker'
import type { WorkflowVarField, WorkflowVarGroup } from '@/types/workflow'

export default function MappingPickerButton({ variables, onInsert }: {
  variables: WorkflowVarGroup[]
  onInsert: (field: WorkflowVarField) => void
}) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  // No upstream module has any catalogued field yet — nothing to map, no
  // affordance (§3 no fake affordance).
  if (variables.length === 0) return null
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* HUISSTIJL-1: the one house button atom — bordered (secondary) at rest so
          it reads as a control beside the input, soft tint while open, mirroring
          the config-field picker toggle's rest/open faces. */}
      <Button type="button" variant={open ? 'soft' : 'secondary'} size="sm" iconOnly
        onClick={() => setOpen(o => !o)} aria-label={t('canvas.mapField')} title={t('canvas.mapField')}>
        <Braces size={12} />
      </Button>
      {open && (
        <PickerPopover variables={variables}
          onInsert={f => { onInsert(f); setOpen(false) }}
          onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
