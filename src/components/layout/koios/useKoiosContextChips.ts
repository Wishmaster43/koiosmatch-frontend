/**
 * useKoiosContextChips — the two AMBIENT context chips for the Koios composer
 * (KOIOS-SELECTIE-CONTEXT-1): (a) whichever record is currently open in the
 * active entity drawer, derived purely from the URL hash (koiosAmbientContext,
 * no fetch, no page wiring); (b) the active list page's own table selection,
 * published via SelectionContext. Both are DERIVED, not user-added state — they
 * track their source live and vanish the instant it does (drawer closed,
 * selection cleared, page switched away).
 *
 * "Dismiss" only hides the CURRENT identity: a dismissed candidate's chip
 * reappears the moment a DIFFERENT record opens, and a dismissed selection
 * reappears the moment the selected id set actually changes — so a stale
 * dismiss can never suppress a genuinely new context.
 *
 * The ambient chip's label is the RECORD's own name where a cheap source
 * exists (today: none — resolving it would mean a live per-record fetch this
 * hook deliberately has none of, see the file banner above); the honest
 * fallback is "<singular entity> #<id>" (koios.contextRecordFallback), never
 * the plural nav label — "Kandidaten" read like the person's own name, which
 * this replaces.
 *
 * The selection chip shows ONE aggregate pill, but the refs it feeds to the
 * outgoing turn are the REAL selected ids (capped, singular ref type) — never
 * the old synthetic `selection:<entity>` id, which could never resolve on the
 * backend regardless of RESOLVABLE_CONTEXT_TYPES.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelectionContext } from '@/context/SelectionContext'
import { deriveAmbientRef, PAGE_TO_REF_TYPE } from './koiosAmbientContext'
import { RESULT_CAP } from './useKoiosEntitySearch'
import type { KoiosContextRef } from '@/types/koios'

// Live URL hash — a plain hashchange/popstate subscription so an open/close on
// the SAME page (not only browser back/forward) updates the ambient ref too.
function useCurrentHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])
  return hash
}

export interface KoiosContextChips {
  ambientRef: KoiosContextRef | null
  // The ONE display pill for the current selection (or null); `refs` are the
  // real per-record context refs the outgoing turn should carry — always
  // separate from the single display ref, since a selection is many records.
  selectionChip: { id: string; label: string; refs: KoiosContextRef[] } | null
  dismissAmbient: () => void
  dismissSelection: () => void
}

export function useKoiosContextChips(): KoiosContextChips {
  const { t } = useTranslation('common')
  const hash = useCurrentHash()
  const { selection } = useSelectionContext()
  const [dismissedAmbientId, setDismissedAmbientId] = useState<string | null>(null)
  const [dismissedSelectionKey, setDismissedSelectionKey] = useState<string | null>(null)

  // The open-drawer chip: prefer a real per-record name (no cheap source
  // exists today — see the file banner); the honest fallback names the
  // SINGULAR entity + id, never the plural nav label ("Kandidaten").
  const raw = deriveAmbientRef(hash)
  const ambientRef: KoiosContextRef | null = raw && raw.id !== dismissedAmbientId
    ? { type: raw.type, id: raw.id, label: t('koios.contextRecordFallback', {
        entity: t(`koios.mention.singular.${raw.type}`), id: raw.id,
      }) }
    : null

  // The selection chip: one aggregate pill ("N <entity> geselecteerd"), keyed
  // on entity+ids so a genuinely different selection always overrides a dismiss.
  const selectionKey = selection ? `${selection.entity}:${selection.ids.join(',')}` : null
  const singularType = selection ? (PAGE_TO_REF_TYPE[selection.entity] ?? selection.entity) : null
  const overflow = selection ? selection.ids.length - RESULT_CAP : 0
  const selectionChip: KoiosContextChips['selectionChip'] = selection && selectionKey !== dismissedSelectionKey
    ? {
        id: `selection:${selection.entity}`,
        label: t('koios.selection.chip', {
          count: selection.ids.length,
          entity: selection.label ?? t(`nav.${selection.entity}`),
        }) + (overflow > 0 ? ' ' + t('koios.selection.moreCount', { count: overflow }) : ''),
        // Real ids, singular ref type — capped the same as every other search
        // result list (RESULT_CAP) so a 200-row selection never floods the turn.
        refs: selection.ids.slice(0, RESULT_CAP).map((id) => ({
          type: singularType!, id: String(id), label: String(id),
        })),
      }
    : null

  return {
    ambientRef,
    selectionChip,
    dismissAmbient: () => setDismissedAmbientId(raw?.id ?? null),
    dismissSelection: () => setDismissedSelectionKey(selectionKey),
  }
}
