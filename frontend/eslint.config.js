import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Mark identifiers used in JSX (incl. member expressions like
      // `motion.div`) as used, so no-unused-vars doesn't false-positive on
      // them. A prior "cleanup" trusted that false positive, removed `motion`,
      // and broke the app — this prevents a repeat.
      'react/jsx-uses-vars': 'error',
      // React Compiler "couldn't preserve manual memoization" is a performance
      // hint (the component just isn't auto-optimized), not a correctness bug —
      // keep it visible as a warning rather than failing the build.
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
])
