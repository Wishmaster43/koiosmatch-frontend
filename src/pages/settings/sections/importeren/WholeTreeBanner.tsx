/**
 * WholeTreeBanner — the explainer for the COMBINED file (backend:
 * CustomerTreeImporter). It replaces ImportOrderBanner for that entity, because the
 * four-step order that banner teaches is flatly wrong here: this one file needs no
 * order at all, and telling a user otherwise is the kind of half-truth this screen
 * was rebuilt to remove.
 *
 * Every sentence below is a verified property of the importer, not a promise:
 *  - one flat row per contact, with the customer/location/department repeated;
 *  - a blank NAME cell for a level stops the row there (level truncation);
 *  - a repeated klant_naam finds the same customer, never a second one;
 *  - a row is ALL-OR-NOTHING (ImportRunner: one transaction per row) — a refused
 *    contact takes its own row's customer down with it, while a customer an EARLIER
 *    row created stays;
 *  - the four separate files stay the right tool for adding to a customer that
 *    already exists — hence the switch button rather than a hidden alternative.
 */
import { useTranslation } from 'react-i18next'
import { ArrowRight, Network } from 'lucide-react'

// The four levels ONE row carries, reusing the entity labels the sub-nav already
// shows so a level is never named twice in two ways.
const LEVELS: readonly string[] = ['customers', 'locations', 'departments', 'contacts']

interface WholeTreeBannerProps {
  /** The entity to switch to for the separate files; null hides the switch. */
  separateEntity: string | null
  onSelectEntity: (entity: string) => void
}

export default function WholeTreeBanner({ separateEntity, onSelectEntity }: WholeTreeBannerProps) {
  const { t } = useTranslation('settings')

  return (
    <div style={{ padding: '12px 14px',
      background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
      borderRadius: 8, marginBottom: 16 }}>
      {/* Title + the levels one single row carries, left to right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
        <Network size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t('import.tree.title')}:</span>
        {LEVELS.map((id, index) => (
          <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t(`import.entities.${id}.label`, { defaultValue: id })}</span>
            {index < LEVELS.length - 1 && <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
          </span>
        ))}
      </div>

      {/* The rules that decide what a row actually does. */}
      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--text-muted)', listStyle: 'disc' }}>
        <li>{t('import.tree.replacesOrder')}</li>
        <li>{t('import.tree.rowGrain')}</li>
        <li>{t('import.tree.levelTruncation')}</li>
        <li>{t('import.tree.allOrNothing')}</li>
      </ul>

      {/* The other path, offered rather than hidden — the four separate files stay
          the right tool for extending a customer that already exists. */}
      {separateEntity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('import.tree.separateAlternative')}</span>
          <button type="button" onClick={() => onSelectEntity(separateEntity)}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none',
                     border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {t('import.tree.switchToSeparate')}
          </button>
        </div>
      )}
    </div>
  )
}
