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
        // GENERIC two-hex-suffix form (r5 finding 3): the old five-suffix list
        // (1A|14|22|33|55) encoded only the house pair and let '20'/'CC'/'18'
        // through — the exact shape of the gap. cvStyles.ts (react-pdf, no
        // color-mix support) carries the one reasoned file-level exception.
        selector: "BinaryExpression[operator='+'] > Literal[value=/^[0-9A-Fa-f]{2}$/]",
        message: "HUISSTIJL: hex-concat tint (colour + 'XX') breaks on tenant tokens, ongeacht het suffix — use tintBg/tintBorder/chipInk from lib/tint.",
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
      },
      {
        // Herhaal-audit r4 finding 2: the inverse --text fill was a hand-rolled
        // FOURTH button identity (four copies found; all retired the same round).
        // Zero-hit at adoption — a returning inverse fill is a build error.
        selector: "JSXOpeningElement[name.name='button'] Property[key.name=/^background(Color)?$/] > Literal[value='var(--text)']",
        message: 'HUISSTIJL: een inverse-vulling (--text als knopvlak) is geen losse knop — de primaire actie leest <Button variant="primary">.',
      },
      {
        // Herhaal-audit r4 findings 5-7: a dropdown TRIGGER is a form field, not an
        // action button — it inherits its face from SearchSelect/fieldMetrics. A
        // hand-painted height inside a renderTrigger is exactly how 30/32px drift
        // arose. Zero-hit at adoption (the four offenders adopted the default face).
        selector: "JSXAttribute[name.name='renderTrigger'] JSXOpeningElement[name.name='button'] Property[key.name='height']",
        message: 'HUISSTIJL: een dropdown-trigger erft zijn maat van SearchSelect/fieldMetrics — geen eigen height in een renderTrigger.',
      },
      {
        // Herhaal-slotaudit 20-08 (SoftChip WCAG-fail, 2.4-3.0:1): text sitting on
        // its own tint never carries the raw colour as ink — that is chipInk's job.
        // Matches an object that tints (tint/tintBg call anywhere in it) while its
        // `color:` VALUE is a bare identifier/member/ternary — chipInk(x) is a
        // CallExpression, so the fixed pattern passes. NOTE the shape (Opus ronde 3,
        // measured): esquery does not resolve a two-level relative inside :has(),
        // and a tail without `.value` also matches the property KEY — both earlier
        // attempts were silently dead. Probe any edit to this selector via stdin.
        selector: "ObjectExpression:has(CallExpression[callee.name=/^tint(Bg)?$/]) > Property[key.name='color'] > .value:matches(Identifier, MemberExpression)",
        message: 'HUISSTIJL: tekst op zijn eigen tint leest chipInk(kleur) uit lib/tint — de bronkleur zelf haalt de 4.5:1 niet (gemeten 2.4-3.0:1).',
      },
      {
        // Same rule, ternary form: `color: on ? col : 'var(--text-muted)'` — only a
        // RAW identifier/member in a BRANCH is the violation; `on ? chipInk(col) : …`
        // is the fix and must pass, so the whole ConditionalExpression is never
        // flagged as one blob. DESCENDANT (not `> ConditionalExpression.value >`):
        // a NESTED ternary hid SegmentedControl's 3.00:1 activeFill ink from the
        // direct-child form (Opus r4) — any ternary depth under color: now counts.
        selector: "ObjectExpression:has(CallExpression[callee.name=/^tint(Bg)?$/]) > Property[key.name='color'] ConditionalExpression > .consequent:matches(Identifier, MemberExpression)",
        message: 'HUISSTIJL: tekst op zijn eigen tint leest chipInk(kleur) uit lib/tint — de bronkleur zelf haalt de 4.5:1 niet (gemeten 2.4-3.0:1).',
      },
      {
        selector: "ObjectExpression:has(CallExpression[callee.name=/^tint(Bg)?$/]) > Property[key.name='color'] ConditionalExpression > .alternate:matches(Identifier, MemberExpression)",
        message: 'HUISSTIJL: tekst op zijn eigen tint leest chipInk(kleur) uit lib/tint — de bronkleur zelf haalt de 4.5:1 niet (gemeten 2.4-3.0:1).',
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
      },
      {
        // Herhaal-audit r6 T-2/T-3: 11px + muted in one style object IS Caption
        // (or GroupLabel with weight/uppercase) — a local copy of the atom.
        // typography.tsx exports the raw identities for the rare object context.
        selector: "ObjectExpression:has(Property[key.name='fontSize'] > Literal[value=11]):has(Property[key.name='color'] > Literal[value='var(--text-muted)'])",
        message: 'HUISSTIJL: 11px muted is Caption/GroupLabel — gebruik het atoom uit components/ui/typography (layout via zijn style-prop, identiteit nooit lokaal).',
      },
      {
        // Herhaal-audit r6 T-4: 13/600 in one style object IS SectionTitle
        // (representative sample measured ~97 copies app-wide — frozen debt via
        // the ceiling, paid down per touched file).
        selector: "ObjectExpression:has(Property[key.name='fontSize'] > Literal[value=13]):has(Property[key.name='fontWeight'] > Literal[value=600])",
        message: 'HUISSTIJL: 13/600 is SectionTitle — gebruik <SectionTitle> uit components/ui/typography.',
      },
      {
        // Herhaal-slotaudit finding 1: BTN_H feeds Button size="md" ONLY (its own
        // docblock says so) — a raw <button> reading it is by definition a copy of
        // Button. Warn bucket: 46 pre-existing hits / 35 files (measured r3.5); the
        // staged gate converts them per touched file. (BTN_H on an INPUT/SELECT
        // aligned to button height is legitimate and stays out of this selector.)
        selector: "JSXOpeningElement[name.name='button'] Property[key.name='height'] > Identifier[name='BTN_H']",
        message: 'HUISSTIJL: een raw <button> op BTN_H is een kopie van Button size="md" — gebruik <Button size="md">.',
      },
      {
        // Herhaal-slotaudit r3 (finding 6): a color-mix ENDING IN `%, transparent`
        // is the §4 tint recipe hand-rolled — that formula lives in lib/tint
        // (tint/tintBg/tintBorder), where the percentages stay one pair. String
        // form; `.*` (not `[^)]*`) so a `var(--…)` token's own paren doesn't hide
        // the tail (r3.5: the narrow form saw 4 of the real hits; the honest
        // count with both working forms is 331 tree-wide — warn bucket, paid
        // down per touched file by the staged gate). Other color-mix uses
        // (hover shades, chipInk's output) are NOT this recipe and stay free.
        selector: "Literal[value=/color-mix\\(in srgb,.*%,\\s*transparent\\)/]",
        message: 'HUISSTIJL: een eigen color-mix-tint (…%, transparent) is de §4-formule met losse percentages — gebruik tint/tintBg/tintBorder uit lib/tint.',
      },
      {
        // Same rule, template-literal form (`${col} 12%, transparent`): a template
        // splits at ${…}, so the opening `color-mix(in srgb,` and the closing
        // `%, transparent)` land in DIFFERENT TemplateElements — the parent
        // TemplateLiteral ties them together. esquery Literal-regexes never match
        // templates at all (the zIndex lesson, twice now).
        selector: "TemplateLiteral:has(TemplateElement[value.raw=/color-mix\\(in srgb/]) > TemplateElement[value.raw=/%,\\s*transparent\\)/]",
        message: 'HUISSTIJL: een eigen color-mix-tint (…%, transparent) is de §4-formule met losse percentages — gebruik tint/tintBg/tintBorder uit lib/tint.',
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
  // Herhaal-audit r4 findings 8/9: the reports map hand-painted the raw accent
  // twice (both count badges). Zero-hit after the CountBadge adoption — this
  // scoped block keeps it that way at 'error' (the same small-scope pattern as
  // huisstijlUiStrict above; tree-wide the selector stays warn: 88 legacy hits).
  {
    files: ['src/components/reports/**/*.{ts,tsx,js,jsx}'],
    ignores: ['src/components/reports/**/*.test.{ts,tsx,js,jsx}'],
    plugins: { huisstijlReportsStrict: huisstijlPlugin },
    rules: {
      'huisstijlReportsStrict/no-restricted-syntax': ['error', {
        selector: "Property[key.name=/^background(Color)?$/] Literal[value='var(--color-primary)']",
        message: 'HUISSTIJL: het rauwe accent als vulling is verboden in reports/ — het accentvlak leest var(--button-fill) (of CountBadge voor telbadges).',
      }],
    },
  },
])
