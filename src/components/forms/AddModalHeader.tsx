/**
 * AddModalHeader — shared header for create modals: optional custom title element
 * + phase/status pills + import toggle (optional) + close button.
 * Pure presentational: selected phase/status value in, onChange/onClose callbacks out.
 * Title rendering is flexible: pass titleElement as a React node to bypass default
 * rendering (for vacancies' PageTitle as="span"), or pass title/subtitle/hint strings
 * for default wrapper-div rendering (candidates).
 */
import { X, Upload, CheckCircle2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import Button from '@/components/ui/Button'
import TitleBarPills from '@/components/ui/TitleBarPills'
import type { LookupOption } from '@/types/common'

interface AddModalHeaderProps {
  /** The selected pill value (e.g. phase/status id). */
  value: string
  /** Options for the TitleBarPills (phase/status lookups). */
  options: LookupOption[]
  /** Called when a pill is selected. */
  onChange: (value: string) => void
  /** Called when close button is clicked. */
  onClose: () => void
  /** Custom title element — rendered as-is, bypasses title/subtitle/hint.
      Use this for custom title rendering (e.g. vacancies' PageTitle as="span"). */
  titleElement?: React.ReactNode
  /** Heading text (e.g. "Nieuwe kandidaat") — ignored if titleElement is provided. */
  title?: string
  /** Optional subtitle (e.g. customer name) — ignored if titleElement is provided. */
  subtitle?: string
  /** Short hint text under the title (e.g. "Vul rood gemarkeerde velden in") — ignored if titleElement is provided. */
  hint?: string
  /** Optional CV entry affordances (upload/paste icons + hint). */
  cvEntryNode?: React.ReactNode
  /** Whether the import button renders — gated on permission. */
  canImport?: boolean
  /** Import button label — REQUIRED, no English default: the caller's own
      translated t('modal.import.title') (round 10 fix, DRY round 10 MODALS). */
  importButtonLabel: string
  /** Import toggle state. */
  importOpen?: boolean
  /** Called when import toggle is clicked. */
  onToggleImport?: () => void
  /** Deepens import button tint once a file is picked. */
  hasFile?: boolean
  /** Accessible label for the pills row — REQUIRED, no English fallback: the
      caller's own translated string (round 10 fix, DRY round 10 MODALS). */
  ariaLabel: string
  /** Translated accessible name for the close button (caller's t('common:close')). */
  closeAriaLabel: string
  /** The outer container's style object, IN THE CONSUMER'S OWN KEY ORDER — each
      consumer's HEAD serialized its style attribute with a different key order
      (candidates: padding, borderBottom, display, alignItems, gap, flexShrink;
      vacancies: padding, borderBottom, flexShrink, display, alignItems, gap), so
      the shared component cannot own one hardcoded order without breaking rule F
      (byte-identical DOM) for one of the two — the consumer supplies the whole
      object instead (round 10 fix, DRY round 10 MODALS). */
  containerStyle: CSSProperties
}

export default function AddModalHeader({
  value, options, onChange, onClose, titleElement, title, subtitle, hint,
  cvEntryNode, canImport = false, importButtonLabel, importOpen = false,
  onToggleImport, hasFile = false, ariaLabel, closeAriaLabel, containerStyle,
}: AddModalHeaderProps) {
  return (
    <div style={containerStyle}>
      {/* Custom title element (vacancies uses PageTitle as="span") — rendered as-is. */}
      {titleElement && titleElement}

      {/* Default title rendering: title in wrapper div with optional subtitle/hint (candidates). */}
      {!titleElement && title && (
        <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {title}
          </div>
          {(subtitle || hint) && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {subtitle || hint}
            </div>
          )}
        </div>
      )}

      {/* Optional CV entry icons + hint. */}
      {cvEntryNode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {cvEntryNode}
        </div>
      )}

      {/* Phase/status pill row — the shared TitleBarPills atom.
          Required field: no clearable, the active pill always stays picked. */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <TitleBarPills options={options} value={value} onChange={onChange} ariaLabel={ariaLabel} />
      </div>

      {/* Import toggle (gated on permission, icon swaps on file pick). */}
      {canImport && (
        <Button type="button" variant="primary" onClick={onToggleImport}
          aria-expanded={importOpen}
          style={{ gap: 6, flexShrink: 0 }}>
          {hasFile ? <CheckCircle2 size={13} /> : <Upload size={13} />}
          {importButtonLabel}
        </Button>
      )}

      {/* Close — the ghost icon button. Accessible name is the caller's translated string. */}
      <Button variant="ghost" iconOnly onClick={onClose} aria-label={closeAriaLabel}>
        <X size={18} />
      </Button>
    </div>
  )
}
