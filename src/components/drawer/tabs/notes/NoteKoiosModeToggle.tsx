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
import { useMyKoiosMode } from '@/pages/auth/useMyKoiosMode'
import type { KoiosMode } from '@/pages/auth/useMyKoiosMode'

const MODES: KoiosMode[] = ['wizard', 'auto']

export default function NoteKoiosModeToggle() {
  const { t } = useTranslation('common')
  const koios = useMyKoiosMode()

  // Loading/error stay quiet here — the assist section above already carries
  // its own honest states; the switch simply doesn't render until it has a
  // real value (never a flash of the wrong mode).
  if (koios.loading || koios.error) return null

  return (
    <div role="group" aria-label={t('notesAssist.koiosMode.title', { defaultValue: 'Koios-modus' })}
      style={{ display: 'flex', borderRadius: 99, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
      {MODES.map(m => {
        const active = koios.mode === m
        const hint = m === 'wizard'
          ? t('notesAssist.koiosMode.wizardHint', { defaultValue: 'Elke actie eerst bevestigen' })
          : t('notesAssist.koiosMode.autoHint', { defaultValue: 'Acties direct uitvoeren (berichten blijven wachten op bevestiging tenzij aangezet in je profiel)' })
        return (
          <button key={m} type="button" onClick={() => koios.setMode(m)} aria-pressed={active} title={hint}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: active ? 600 : 500, cursor: 'pointer', border: 'none',
              background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent',
              color: active ? 'var(--color-primary)' : 'var(--text-muted)',
            }}>
            {t(`notesAssist.koiosMode.${m}`, { defaultValue: m === 'wizard' ? 'Wizard' : 'Auto' })}
          </button>
        )
      })}
    </div>
  )
}
