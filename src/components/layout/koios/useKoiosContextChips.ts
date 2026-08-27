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
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

// Live URL hash — a plain hashchange/popstate subscription so an open/close on
// the SAME page (not only browser back/forward) updates the ambient ref too.
function useCurrentHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  // Subscribes to hashchange and popstate so the ambient ref updates on an in-page drawer open/close, not only on browser navigation.
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


// Per-type record-label fetch for the ambient chip: application = "kandidaat ·
// vacature" (KANDIDAAT-EERST), the rest their own display name. Unknown types
// and failures resolve to null so the honest fallback stays; the query caches
// per record and never retries a hard failure into a loop.
const REF_LABEL_SOURCES: Record<string, { path: (id: string) => string; pick: (d: Record<string, unknown>) => string | null }> = {
  candidate:   { path: id => `/candidates/${id}`,   pick: d => (d.name as string) ?? null },
  customer:    { path: id => `/customers/${id}`,    pick: d => (d.name as string) ?? null },
  vacancy:     { path: id => `/vacancies/${id}`,    pick: d => (d.title as string) ?? (d.name as string) ?? null },
  task:        { path: id => `/tasks/${id}`,        pick: d => (d.title as string) ?? null },
  opportunity: { path: id => `/opportunities/${id}`, pick: d => (d.title as string) ?? (d.name as string) ?? null },
  application: { path: id => `/applications/${id}`, pick: d => {
    const cand = ((d.candidate as Record<string, unknown>)?.name ?? d.candidate_name) as string | undefined
    const vac  = ((d.vacancy as Record<string, unknown>)?.title ?? d.vacancy_title) as string | undefined
    return cand ? (vac ? `${cand} · ${vac}` : cand) : null
  } },
  match:       { path: id => `/matches/${id}`,      pick: d => {
    const cand = ((d.candidate as Record<string, unknown>)?.name ?? d.candidate_name) as string | undefined
    const vac  = ((d.vacancy as Record<string, unknown>)?.title ?? d.vacancy_title) as string | undefined
    return cand ? (vac ? `${cand} · ${vac}` : cand) : null
  } },
}

// Resolves the open record's display label; null while loading/failed/unknown type.
function useAmbientRefLabel(type?: string, id?: string): string | null {
  const source = type ? REF_LABEL_SOURCES[type] : undefined
  const { data } = useQuery({
    queryKey: ['koios', 'ref-label', type, id],
    enabled: Boolean(source && id),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const res = await api.get(source!.path(String(id)))
      const body = (unwrap<Record<string, unknown>>(res) ?? {}) as Record<string, unknown>
      return source!.pick(body)
    },
  })
  return data ?? null
}

// See the file's top doc above for the two ambient/selection chips this hook derives and their dismiss semantics.
export function useKoiosContextChips(): KoiosContextChips {
  const { t } = useTranslation('common')
  const hash = useCurrentHash()
  const { selection } = useSelectionContext()
  const [dismissedAmbientId, setDismissedAmbientId] = useState<string | null>(null)
  const [dismissedSelectionKey, setDismissedSelectionKey] = useState<string | null>(null)

  // The open-drawer chip: the RECORD'S OWN NAME (Danny 27-08, screenshot of a
  // raw application UUID in the chip: "mooier is de naam van de kandidaat en de
  // vacature naam") — resolved with one cheap GET per open record; while it
  // loads (or when it fails) the honest entity+id fallback stands.
  const raw = deriveAmbientRef(hash)
  const resolvedLabel = useAmbientRefLabel(raw?.type, raw?.id)
  const ambientRef: KoiosContextRef | null = raw && raw.id !== dismissedAmbientId
    ? { type: raw.type, id: raw.id, label: resolvedLabel ?? t('koios.contextRecordFallback', {
        entity: t(`koios.mention.singular.${raw.type}`), id: raw.id,
      }) }
    : null

  // The selection chip: one aggregate pill ("N <entity> geselecteerd"), keyed
  // on entity+ids so a genuinely different selection always overrides a dismiss.
  const selectionKey = selection ? `${selection.entity}:${selection.ids.join(',')}` : null
  const singularType = selection ? (PAGE_TO_REF_TYPE[selection.entity] ?? selection.entity) : null
  const overflow = selection ? selection.ids.length - RESULT_CAP : 0
  // A single selected record shows its NAME (Danny 27-08: "nu zie je weer niet
  // welke") via the same resolver as the ambient chip; the singular fallback
  // stands while it loads. Multi-selection keeps the count chip.
  const singleId = selection && selection.ids.length === 1 ? String(selection.ids[0]) : undefined
  const singleLabel = useAmbientRefLabel(singleId ? (singularType ?? undefined) : undefined, singleId)
  const selectionChip: KoiosContextChips['selectionChip'] = selection && selectionKey !== dismissedSelectionKey
    ? {
        id: `selection:${selection.entity}`,
        label: (singleId
          ? (singleLabel ?? t('koios.selection.chipOne', { entity: t(`koios.mention.singular.${singularType}`) }))
          : t('koios.selection.chip', {
              count: selection.ids.length,
              entity: selection.label ?? t(`nav.${selection.entity}`),
            })) + (overflow > 0 ? ' ' + t('koios.selection.moreCount', { count: overflow }) : ''),
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
