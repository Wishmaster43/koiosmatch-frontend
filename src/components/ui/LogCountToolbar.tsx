/**
 * LogCountToolbar — shared count-summary + CSV-export toolbar row for a log/audit
 * table (LogView, AuditLog). Extracted so the two screens never drift on this
 * markup (DRY, jscpd clone found during JSX2TS-FE lane D).
 */
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import Button from './Button'

interface LogCountToolbarProps {
  loading?: boolean
  shown: number
  total: number
  onExport: () => void
  exportDisabled: boolean
}

// Count summary on the left, CSV export button on the right — the count reads
// "loading…" until the first fetch resolves.
export default function LogCountToolbar({ loading, shown, total, onExport, exportDisabled }: LogCountToolbarProps) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {loading ? t('audit.loading') : t('audit.countSummary', { shown, total })}
      </p>
      <Button variant="secondary" size="sm" onClick={onExport} disabled={exportDisabled}>
        <Download size={13} /> {t('audit.export')}
      </Button>
    </div>
  )
}
