import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Project rule tuning:
// - allowEmptyCatch: swallowing an error in catch {} is an intentional pattern here.
// - set-state-in-effect: off — fires on the standard "setLoading(true) before a
//   fetch" pattern used throughout; not a correctness issue.
// - only-export-components: warn — HMR-only nicety, not worth blocking the build.
const projectRules = {
  'no-empty': ['error', { allowEmptyCatch: true }],
  'react-hooks/set-state-in-effect': 'off',
  'react-refresh/only-export-components': 'warn',
  // react-hooks v7 advisory rules that the codebase pervasively trips (inline
  // component definitions, etc.) — kept visible as warnings, a real refactor for later.
  'react-hooks/static-components': 'warn',
  'react-hooks/immutability': 'warn',
  // Steer new code to the "@/" alias; deep ../../ chains are flagged but the 400+
  // existing ones stay warnings (converted per-touch, CLAUDE.md §11 / CS-8).
  'no-restricted-imports': ['warn', {
    patterns: [{
      group: ['../../**'],
      message: 'Use the "@/" alias instead of deep relative imports (../../…). See CLAUDE.md §11.',
    }],
  }],
}

export default defineConfig([
  globalIgnores(['dist', 'dist-careersite']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: projectRules,
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: projectRules,
  },
  // Hex-stop guard (CLAUDE.md §4): colours come from design tokens, not ad-hoc hex.
  // Warn-level on purpose — legitimate DATA hexes (seed palettes) must not break the
  // pre-commit/CI gate, which only fails on errors ("eslint ." without --max-warnings).
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['warn', {
        selector: 'Literal[value=/#[0-9A-Fa-f]{6}/]',
        message: 'Ad-hoc hex colour — use a design token (var(--color-*)/color-mix), or add an eslint-disable-next-line with a reason if this hex is DATA (seed/palette).',
      },
      // ── HUISSTIJL-1 fase 3 (Danny 19/20-08): drift is a BUILD ERROR from here on. ──
      {
        // A hand-painted accent/danger action fill outside the design system —
        // the identity belongs to components/ui/Button (or the --button-* trio).
        selector: "Property[key.name=/^background(Color)?$/] > Literal[value='var(--color-primary)']",
        message: 'HUISSTIJL: a solid accent fill is Button/DrawerAddButton territory (or var(--button-fill)) — never hand-painted per element.',
      },
      {
        // The hex-concat tint recipe silently breaks on var() tenant tokens.
        selector: "BinaryExpression[operator='+'] > Literal[value=/^(1A|14|22|33|55)$/]",
        message: "HUISSTIJL: hex-concat tint (colour + '1A') breaks on tenant tokens — use tintBg/tintBorder from lib/tint.",
      },
      {
        // Z-index literals outside the ladder: stacking inversions only show with
        // two surfaces open at once (the toast-behind-datepicker class).
        selector: "Property[key.name='zIndex'] > Literal[value=/^(?!([1-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9])$)\\d{2,}$/]",
        message: 'HUISSTIJL: z-index rides the ladder (--z-drawer/overlay/popover/confirm/toast) or lib/zIndexScale — never a loose number ≥50.',
      },
      {
        // Hand-rolled shadows drift into 35 variants; three levels exist.
        selector: "Property[key.name='boxShadow'] > Literal[value=/rgba?\\(/]",
        message: 'HUISSTIJL: shadows are --shadow-card/float/modal/drawer — a bespoke boxShadow needs an eslint-disable with its reason (thumb/status-ring class).',
      }],
    },
  },
])
