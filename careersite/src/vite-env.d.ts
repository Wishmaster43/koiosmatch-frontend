/// <reference types="vite/client" />

// Typed env vars for this standalone app (VITE_* is always public, CLAUDE.md §7).
interface ImportMetaEnv {
  readonly VITE_CAREER_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
