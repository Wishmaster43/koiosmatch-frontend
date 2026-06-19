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
}

export default defineConfig([
  globalIgnores(['dist']),
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
])
