/**
 * buildTestConfig — sanitizes an ai_agent step's config before it is POSTed to
 * the PAID /ai/agents/test endpoint. INTERVIEW-WORKFLOW-1 repurposed the
 * `instructions` key from a legacy persona STRING into an array of rows, but
 * AgentChatService.php:78 still reads `config.instructions` as a fallback
 * persona string when `config.instruction` is absent and casts it with
 * `(string) $instruction` — an unfiltered array becomes the literal persona
 * "Array" on a real, billed test run (§0 API-CREDITS-1). A fresh ai_agent node
 * has no `instruction` default (`useWorkflowEditor.ts` only seeds fields that
 * declare one), so this is the first-use path, not an edge case. Fix: never
 * forward the array — drop it, and when there is no persona text yet, render
 * a plain-text numbered fallback from the instruction rows so the test still
 * exercises what the user actually configured.
 */
export function buildTestConfig(config?: Record<string, unknown>): Record<string, unknown> {
  const cfg: Record<string, unknown> = { ...(config ?? {}) }
  const rows = Array.isArray(cfg.instructions) ? (cfg.instructions as Array<{ text?: string }>) : []
  delete cfg.instructions
  // A non-string persona never reaches the paid endpoint either (Opus round 3, hardening).
  if (cfg.instruction !== undefined && typeof cfg.instruction !== 'string') delete cfg.instruction
  const persona = typeof cfg.instruction === 'string' ? cfg.instruction : ''
  if (!persona.trim() && rows.length) {
    cfg.instruction = rows.map((row, i) => `${i + 1}. ${stripHtml(row.text ?? '')}`).join('\n')
  }
  return cfg
}

// Plain-text extraction of a rich-text instruction row (HTML in, text out).
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
