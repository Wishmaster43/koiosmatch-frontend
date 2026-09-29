/**
 * english-code-ignore: this file's LEFT-hand keys are the deliberate legacy
 * Dutch `search_all` bucket names the backend still sends dual-key during the
 * KOIOS-EN-1 phase B window — a translation table, not new Dutch code, so it
 * is exempt from the english-code ratchet.
 *
 * koiosResultBucketAliases — FIND-1 (BE api during-onix 66b2745a/4463bdbe):
 * the `search_all` step result carries English-first bucket keys with a Dutch
 * fallback during the transition. Kept as its own alias file (mirrors
 * koiosToolIds.ts's LEGACY_TOOL_IDS) so KoiosMessage.tsx's own entity map
 * stays English-only. TODO: remove once the backend drops the Dutch keys.
 */
export const LEGACY_RESULT_BUCKET_TYPES: Record<string, string> = {
  kandidaten: 'candidate',
  vacatures: 'vacancy',
  klanten: 'customer',
  kansen: 'opportunity',
  contactpersonen: 'contact',
  taken: 'task',
  locaties: 'location',
}
