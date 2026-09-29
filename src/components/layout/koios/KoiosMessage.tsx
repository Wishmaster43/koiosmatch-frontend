/**
 * KoiosMessage — one chat bubble in the panel's message list, plus the
 * resolveMessage helper that maps a chat message to its display text/notice
 * flag. Split out of KoiosPanel (§0.3 size discipline, KOIOSPANEL-SPLIT-1) —
 * purely presentational, all chat state lives in useKoiosChat; the shared
 * GRADIENT + resolveMessage live in koiosMessageParts (non-component module).
 */
import { Bot } from 'lucide-react'
import SafeHtml from '@/components/ui/SafeHtml'
import { humanizeIsoDates } from '@/lib/localDate'
import { koiosMarkdownToHtml } from './koiosMarkdown'
import KoiosSteps from './KoiosSteps'
import KoiosPendingActionCard from './KoiosPendingActionCard'
import KoiosResultCards from './KoiosResultCards'
import KoiosFeedback from './KoiosFeedback'
import type { KoiosResultRef, KoiosSearchResultsGrouped } from './koiosTypes'
import type { KoiosChatMessage, TFn } from '@/types/koios'
import { GRADIENT, resolveMessage, type KoiosGreeting } from './koiosMessageParts'
import { canonicalToolId, pick } from './koiosToolIds'
import { LEGACY_RESULT_BUCKET_TYPES } from './koiosResultBucketAliases'

// ── Group search results by entity type ────────────────────────────────────────
// Maps backend entity keys to FE ref types. KOIOS-EN-1 phase B: the search_all
// result's per-entity keys move to English plurals; the Dutch generation is kept
// during the alias period via LEGACY_RESULT_BUCKET_TYPES (a not-yet-updated
// payload still groups correctly). FIND-1 (BE FIND-1/FIND-1b) widened
// `search_all`'s buckets past the original five to contacts/tasks/locations.
const ENTITY_TYPE_MAP: Record<string, string> = {
  ...LEGACY_RESULT_BUCKET_TYPES,
  matches: 'match',
  candidates: 'candidate',
  vacancies: 'vacancy',
  customers: 'customer',
  opportunities: 'opportunity',
  contacts: 'contact',
  tasks: 'task',
  locations: 'location',
}

// Extracts per-entity search metadata and groups refs by entity type.
// If the backend sends full metadata in the step (e.g. for a zoek_alles tool),
// this parses it; otherwise, reconstructs grouping from refs alone.
function groupSearchResults(step: Record<string, unknown>, refs: KoiosResultRef[]): KoiosSearchResultsGrouped {
  const groups: KoiosSearchResultsGrouped['groups'] = []
  const skipped: KoiosSearchResultsGrouped['skipped'] = []

  // Try to extract per-entity metadata from the step if present (backend may
  // include raw tool output as { query, result: {...} } — KOIOS-EN-1 phase B:
  // English-first `result`, Dutch fallback `resultaten`, plus the pre-existing
  // `results` alias — during the dual-key period).
  const resultaten = (pick<Record<string, unknown>>(step, 'result', 'resultaten') ?? step.results) as Record<string, unknown> | undefined
  const resultaatPerEntity = resultaten || {}

  // Group refs by entity type in the canonical order
  const refsByEntity = new Map<string, KoiosResultRef[]>()
  for (const ref of refs) {
    const list = refsByEntity.get(ref.type) || []
    list.push(ref)
    refsByEntity.set(ref.type, list)
  }

  // Render groups in a canonical order, then anything else the backend sent
  // (FIND-1: a bucket key this FE has never seen still gets its own group,
  // never silently dropped — the raw key is the fallback entity label).
  const entityOrder = ['candidate', 'vacancy', 'customer', 'opportunity', 'match', 'contact', 'task', 'location']
  const seen = new Set<string>()
  const bucketEntityTypes = Object.keys(resultaatPerEntity).map((key) => ENTITY_TYPE_MAP[key] || key)
  const refEntityTypes = Array.from(refsByEntity.keys())
  for (const entityType of [...entityOrder, ...bucketEntityTypes, ...refEntityTypes]) {
    if (seen.has(entityType)) continue
    seen.add(entityType)
    const entityRefs = refsByEntity.get(entityType) || []
    const bucketKey = Object.keys(resultaatPerEntity).find((key) => (ENTITY_TYPE_MAP[key] || key) === entityType)
    if (entityRefs.length > 0 || (bucketKey && resultaatPerEntity[bucketKey])) {
      groups.push({
        entity: entityType,
        refs: entityRefs,
        count: entityRefs.length,
        more: false,
      })
    }
  }

  // Collect skipped entities from the step's per-entity metadata (English-first
  // `skipped`/`reason`, Dutch fallback `overgeslagen`/`reden`).
  for (const [key, value] of Object.entries(resultaatPerEntity)) {
    const entry = value as Record<string, unknown>
    const isSkipped = pick<boolean>(entry, 'skipped', 'overgeslagen') === true
    const reason = pick<string>(entry, 'reason', 'reden')
    if (isSkipped && typeof reason === 'string') {
      const entityType = ENTITY_TYPE_MAP[key] || key
      skipped.push({ entity: entityType, reason })
    }
  }

  return { groups, skipped }
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
// `greeting` feeds the welcome bubble (name + attention count); model/token usage is
// never rendered to the end user (Danny 09-09: "nooit meer tonen is intern iets").
export default function KoiosMessage({ msg, isNew, t, greeting }: { msg: KoiosChatMessage; isNew?: boolean; t: TFn; greeting?: KoiosGreeting }) {
  const isKoios = msg.role !== 'user'
  const { text, notice } = resolveMessage(msg, t, greeting)
  // Subtle tag under the bubble for a self-refusal or an unfinished (max_steps) run.
  const stopTag = isKoios && !notice && msg.stopReason === 'refusal' ? t('koios.stopRefused')
    : isKoios && !notice && msg.stopReason === 'max_steps' ? t('koios.stopMaxSteps') : null
  // Job 3: Group search results by entity type, with per-entity metadata.
  // First, flatten all refs from all steps.
  const resultRefs: KoiosResultRef[] = (msg.steps ?? []).flatMap((s) => s.refs ?? [])
  // Then, try to find a search_all step and group results by entity with metadata
  // (KOIOS-EN-1 phase A: tool ids are English; canonicalToolId still resolves a
  // not-yet-updated 'zoek_alles').
  const searchAllStep = (msg.steps ?? []).find((s) => s.tool && canonicalToolId(s.tool) === 'search_all')
  const groupedResults: KoiosSearchResultsGrouped = searchAllStep
    ? groupSearchResults(searchAllStep, resultRefs)
    : { groups: resultRefs.length > 0 ? [{ entity: 'candidate', refs: resultRefs, count: resultRefs.length, more: false }] : [], skipped: [] }

  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isKoios ? 'row' : 'row-reverse',
      alignItems: 'flex-end', animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none' }}>
      {isKoios && (
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginBottom: 2,
          background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* GRADIENT embeds the tenant accent — the on-accent token, not a hardcoded white. */}
          <Bot size={13} color="var(--color-on-accent)" />
        </div>
      )}
      <div style={{ maxWidth: '84%', display: 'flex', flexDirection: 'column',
        alignItems: isKoios ? 'flex-start' : 'flex-end' }}>
        <div style={{
          padding: '9px 13px',
          borderRadius: isKoios ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          fontSize: 13, lineHeight: 1.6, whiteSpace: isKoios && !notice ? 'normal' : 'pre-wrap',
          background: isKoios ? 'var(--surface)' : GRADIENT,
          color:      isKoios ? (notice ? 'var(--text-muted)' : 'var(--text)') : 'var(--color-on-accent)',
          border:     isKoios ? '1px solid var(--border)' : 'none',
          // HUISSTIJL-1: colored glow tied to the gradient bubble background, none of card/float/modal — kept.
          boxShadow:  isKoios ? 'none' : '0 2px 10px rgba(99,102,241,0.35)',
        }}>
          {/* DATUM-1: rewrite any AI-composed ISO date to DD-MM-YYYY before markdown/DOMPurify; assistant replies render basic markdown (bold/lists) through SafeHtml, user text and notices stay plain. */}
          {isKoios && !notice ? <SafeHtml html={koiosMarkdownToHtml(humanizeIsoDates(text ?? ''))} /> : text}
        </div>
        {stopTag && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{stopTag}</div>}
        {/* Job 2 (dormant): a proposed write waiting for the user's confirm/cancel. */}
        {isKoios && !notice && msg.pendingAction && <KoiosPendingActionCard action={msg.pendingAction} />}
        {/* Job 3: deep-link cards grouped by entity type, from a search tool step. */}
        {isKoios && !notice && (groupedResults.groups.length > 0 || groupedResults.skipped.length > 0) && <KoiosResultCards groups={groupedResults} t={t} />}
        {isKoios && !notice && <KoiosSteps steps={msg.steps} t={t} />}
        {/* KOIOS-FEEDBACK-FE-1: thumbs up/down, only when the backend logged this answer. */}
        {isKoios && !notice && msg.prompt_log_id && (
          <div style={{ marginTop: 4 }}>
            <KoiosFeedback promptLogId={msg.prompt_log_id} surface="chat" t={t} />
          </div>
        )}
      </div>
    </div>
  )
}
