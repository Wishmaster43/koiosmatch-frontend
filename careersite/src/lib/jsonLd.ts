// Serializes the server-provided schema.org JobPosting object for embedding inside a
// <script type="application/ld+json"> tag (Google Jobs indexing). Render it as a plain
// JSX text child — `<script>{toJsonLdString(json_ld)}</script>` — NEVER via
// dangerouslySetInnerHTML: React sets that text through the DOM text-node API, which never
// re-parses the string as HTML, so no "</script>" escaping is needed and no markup-injection
// risk exists. This keeps the app's only dangerouslySetInnerHTML usage confined to
// SafeHtml.tsx (CLAUDE.md §7: sanitized + a written reason, never a second bare usage).
export function toJsonLdString(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd)
}
