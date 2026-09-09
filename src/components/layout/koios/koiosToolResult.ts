/**
 * koiosToolResult — the record a confirmed Koios tool CREATED, as a deep-link ref
 * (§0B "a link to the record it created"; Danny 09-09: "Uitvoeren doet niets … ik mis
 * de hyperlinks bij de gemaakte taken"). Pure mapper over the tool's own result body
 * (ToolExecutor::executePending hands the tool result back under `data`), so the
 * assistant block and the pending-action card render the SAME chip.
 */
import type { KoiosContextRef } from '@/types/koios'

// A tool result → the created record's ref, or null when the tool created nothing
// we can link (search tools, refusals, older shapes).
export function createdRefFromToolResult(data: unknown, fallbackLabel: string): KoiosContextRef | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.gelukt === false) return null
  // maak_taak → { gelukt, taak_id, titel, deadline }
  if (d.taak_id != null && d.taak_id !== '') {
    return { type: 'task', id: String(d.taak_id), label: typeof d.titel === 'string' && d.titel ? d.titel : fallbackLabel }
  }
  return null
}
