import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { builtinRules } from 'eslint/use-at-your-own-risk'

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

// HUISSTIJL slotaudit — a local "plugin" that re-exposes the built-in
// no-restricted-syntax rule under alias names. ESLint flat config MERGES config
// objects per rule KEY: when two objects both set the plain `no-restricted-syntax`
// rule for overlapping `files`, the LATER object's array (severity + all its
// selectors) entirely REPLACES the earlier one's — it does not concatenate
// selectors (measured while building this file: a naive three-block split left
// only the last block's selectors active, silently dropping the 'error' bucket).
// Since one rule instance can only carry ONE severity for its whole selector
// array, running four independent HUISSTIJL selector buckets (two severities,
// plus a components/ui/**-only override) needs four distinct rule KEYS — hence
// the aliases below, each wired to the exact same rule implementation.
const huisstijlPlugin = {
  rules: {
    'no-restricted-syntax': builtinRules.get('no-restricted-syntax'),
  },
}

export default defineConfig([
  globalIgnores(['dist', 'dist-careersite']),
  // typography.houseStyle.test.js (HUISSTIJL slotaudit T6/T7) walks the source
  // tree with node:fs/node:path at test time, so it needs `process`/Node globals
  // on top of the browser set every other test file runs under.
  {
    files: ['src/components/ui/typography.houseStyle.test.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
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
  // The ONLY block using the plain (unaliased) `no-restricted-syntax` key — every
  // other HUISSTIJL bucket below uses an alias so they stack instead of overriding.
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['warn', {
        selector: 'Literal[value=/#[0-9A-Fa-f]{6}/]',
        message: 'Ad-hoc hex colour — use a design token (var(--color-*)/color-mix), or add an eslint-disable-next-line with a reason if this hex is DATA (seed/palette).',
      }],
    },
  },
  // ── HUISSTIJL-1 fase 3 (Danny 19/20-08): drift is a BUILD ERROR from here on. ──
  // Measured against the whole src tree while building this block: zero pre-existing
  // hits for these three selectors (the two remaining height-34 hits were genuine
  // 34px search-chrome / calendar-grid exceptions, tagged with their own disable
  // comments), so a global 'error' is safe today. The numeric zIndex selectors were
  // added AFTER that first pass (Opus review, 20-08): an esquery /regex/ selector
  // only matches STRING literals, so a numeric `zIndex: 200` sailed straight through
  // the original string-only rule. That numeric form surfaced 16 pre-existing hits;
  // every one was migrated onto the ladder/lib/zIndexScale, or given a reasoned
  // disable tag right in the same change that added the selector — so 'error' is
  // true again at delivery: not "zero hits ever", but "zero hits left unresolved".
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: { huisstijl: huisstijlPlugin },
    rules: {
      'huisstijl/no-restricted-syntax': ['error', {
        // The hex-concat tint recipe silently breaks on var() tenant tokens.
        selector: "BinaryExpression[operator='+'] > Literal[value=/^(1A|14|22|33|55)$/]",
        message: "HUISSTIJL: hex-concat tint (colour + '1A') breaks on tenant tokens — use tintBg/tintBorder from lib/tint.",
      },
      {
        // Z-index literals outside the ladder: stacking inversions only show with
        // two surfaces open at once (the toast-behind-datepicker class). Numeric
        // form — an esquery /regex/ only matches STRING literals, so `zIndex: 200`
        // sailed through the old selector (Opus-review slotaudit, 20-08).
        selector: "Property[key.name='zIndex'] > Literal[value>=50]",
        message: 'HUISSTIJL: z-index rides the ladder (--z-drawer/overlay/popover/confirm/toast) or lib/zIndexScale — never a loose number ≥50.',
      },
      {
        // Same rule, string form ("200" / '9999') — regex only reaches strings.
        selector: "Property[key.name='zIndex'] > Literal[value=/^(?!([1-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9])$)\\d{2,}$/]",
        message: 'HUISSTIJL: z-index rides the ladder (--z-drawer/overlay/popover/confirm/toast) or lib/zIndexScale — never a loose number ≥50.',
      },
      {
        // HUISSTIJL slotaudit V1–V6/BTN-2: Button's own sm/md heights are 28/34px —
        // a raw <button> hand-painting 34px is always a copy of Button size="md",
        // never a legitimate third height. Closed for every named finding in this audit.
        selector: "JSXOpeningElement[name.name='button'] Property[key.name='height'] > Literal[value=34]",
        message: 'HUISSTIJL: knophoogte komt uit Button (sm=28, md=34 via size="md") — een losse 34px raw <button> is altijd een kopie, gebruik <Button>.',
      }],
    },
  },
  // ── HUISSTIJL-1 fase 3, legacy-debt bucket — 'warn' globally, hard-enforced only
  // on STAGED files via .githooks/pre-commit (HUISSTIJL slotaudit §2.3). Measured
  // while building this config (`eslint src` before this change): primary-fill 88
  // hits/112 files and boxShadow 48 hits — both far beyond this audit's 20 named
  // findings, so they join the other three selectors the doc itself flagged as
  // too-large-for-a-blanket-error (V7 links: 47, V8 raw buttons: 787, T1/T3/T4/T5
  // 15px titles: 65). An immediate global 'error' would block on debt this audit
  // did not touch, not on anything a commit introduces — every file you STAGE still
  // gets the hard check below; the rest of the tree pays down over time. ──
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: { huisstijlLegacy: huisstijlPlugin },
    rules: {
      'huisstijlLegacy/no-restricted-syntax': ['warn', {
        // A hand-painted accent/danger action fill outside the design system —
        // the identity belongs to components/ui/Button (or the --button-* trio).
        // Descendant (not direct-child) combinator (HUISSTIJL slotaudit V8/BTN-*):
        // a ternary fill (`cond ? 'var(--color-primary)' : x`) nests the Literal one
        // level deeper inside a ConditionalExpression — the old `>` let it through.
        selector: "Property[key.name=/^background(Color)?$/] Literal[value='var(--color-primary)']",
        message: 'HUISSTIJL: a solid accent fill is Button/DrawerAddButton territory (or var(--button-fill)) — never hand-painted per element, incl. inside a ternary.',
      },
      {
        // Hand-rolled shadows drift into 35 variants; three levels exist.
        selector: "Property[key.name='boxShadow'] > Literal[value=/rgba?\\(/]",
        message: 'HUISSTIJL: shadows are --shadow-card/float/modal/drawer — a bespoke boxShadow needs an eslint-disable with its reason (thumb/status-ring class).',
      },
      {
        // HUISSTIJL slotaudit V8/BTN-4/BTN-5: every knop is components/ui/Button —
        // an inline-gestylede <button> is a finding; layout may still ride Button's
        // own `style` prop once migrated.
        selector: "JSXOpeningElement[name.name='button'] > JSXAttribute[name.name='style']",
        message: 'HUISSTIJL: elke knop is components/ui/Button — een inline-gestylede <button> is een finding; layout mag via Button’s style-prop.',
      },
      {
        // HUISSTIJL slotaudit V7: a link that looks like a button renders via
        // <Button href=…> (mailto/tel/download) so it shares one identity.
        selector: "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='style']",
        message: "HUISSTIJL: een link die eruitziet als een knop rendert via <Button href=…> — een inline-gestylede <a> drift.",
      },
      {
        // HUISSTIJL slotaudit T1/T3/T4/T5: 15px is PageTitle's own size, nowhere else.
        selector: "Property[key.name='fontSize'] > Literal[value=15]",
        message: "HUISSTIJL: 15px is PageTitle — gebruik <PageTitle as='…'> uit components/ui/typography (rendert standaard als <h2>, dus ook een drop-in voor een kop).",
      }],
    },
  },
  // The house typography/button map itself must contain ZERO hand-styled 15px
  // titles (HUISSTIJL slotaudit T2) — small, contained surface, so this one can be
  // 'error' immediately instead of riding the staged-only ratchet above. Stacks
  // ON TOP of the legacy-debt 'warn' bucket above (different rule key, so both
  // fire) rather than replacing it — ui/** files keep the raw-button/anchor-style
  // warnings too. typography.tsx is exempt: it is PageTitle's own canonical
  // 15/600 DEFINITION, not a copy of it.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    ignores: ['src/components/ui/typography.tsx', 'src/components/ui/**/*.test.{ts,tsx}'],
    plugins: { huisstijlUiStrict: huisstijlPlugin },
    rules: {
      'huisstijlUiStrict/no-restricted-syntax': ['error', {
        selector: "Property[key.name='fontSize'] > Literal[value=15]",
        message: "HUISSTIJL: 15px is PageTitle — gebruik <PageTitle as='…'> uit components/ui/typography. De huisstijlmap zelf mag geen handgestylede kop bevatten.",
      }],
    },
  },
])
