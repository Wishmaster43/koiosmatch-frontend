/**
 * NoteKoiosModeToggle — compact Wizard/Auto pill switch for the note popup's
 * Koios AI assist section header (K0, "Wizard/Auto-schuif IN de popup, compact,
 * near the assist section"). Reuses the SAME per-user GET/PUT resource + hook
 * the profile "Weergave" tab uses (`useMyKoiosMode`, src/pages/auth/) — one
 * source of truth for the setting, never a forked copy; this file only renders
 * a smaller variant of that same two-state switch for the tighter popup
 * footprint (no auto_messages checkbox here — that stays the profile's own
 * control; a title hint on the Auto pill explains the message-confirm rule).
 */
import { useTranslation } from 'react-i18next'
import { useMyKoiosMode } from '@/pages/auth/shared'
import type { KoiosMode } from '@/pages/auth/shared'

const MODES: KoiosMode[] = ['wizard', 'auto']

// Compact Wizard/Auto pill for the note popup's assist header; renders nothing until the shared per-user mode has loaded, to avoid flashing the wrong mode.
export default function NoteKoiosModeToggle() {
  const { t } = useTranslation('common')
  const koios = useMyKoiosMode()

  // Loading/error stay quiet here — the assist section above already carries
  // its own honest states; the switch simply doesn't render until it has a
  // real value (never a flash of the wrong mode).
  if (koios.loading || koios.error) return null

  return (
    <div role="group" aria-label={t('notesAssist.koiosMode.title')}
      style={{ display: 'flex', borderRadius: 99, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
      {MODES.map(m => {
        const active = koios.mode === m
        const hint = m === 'wizard'
          ? t('notesAssist.koiosMode.wizardHint')
          : t('notesAssist.koiosMode.autoHint')
        return (
          <button key={m} type="button" onClick={() => koios.setMode(m)} aria-pressed={active} title={hint}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- K0 compact two-state mode pill in the assist header: 22px joined pair, Button's sm chrome (28px + padding) breaks the pill geometry; identity stays on the house trio tokens below
            style={{
              padding: '3px 10px', fontSize: 11.5, fontWeight: active ? 600 : 500, cursor: 'pointer', border: 'none',
              // HUISSTIJL-1: the SELECTED mode pill reads the house trio, solid.
              background: active ? 'var(--button-fill)' : 'transparent',
              color: active ? 'var(--button-ink)' : 'var(--text-muted)',
            }}>
            {t(`notesAssist.koiosMode.${m}`, { defaultValue: m === 'wizard' ? 'Wizard' : 'Auto' })}
          </button>
        )
      })}
    </div>
  )
}
