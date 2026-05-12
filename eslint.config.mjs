// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
{
    rules: {
      // Progressively tightened rules — do not loosen without a team discussion
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      // unsafe-argument still has widespread violations; left off until cleaned up
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-console': 'error',
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      'prettier/prettier': ['error', { 'singleQuote': true }],
    },
  },
  // Test files: allow console.* (Logger not available outside DI context)
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
