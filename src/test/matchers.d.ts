// Type of the project's own inline-style matcher registered in src/test/setup.js (see the comment there).
import type { CSSProperties } from 'react'
import 'vitest'

type InlineStyleInput = string | CSSProperties | Record<string, string | number | undefined>

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveInlineStyle(css: InlineStyleInput): T
  }
  interface AsymmetricMatchersContaining {
    toHaveInlineStyle(css: InlineStyleInput): unknown
  }
}
