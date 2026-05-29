import js from '@eslint/js';
import globals from 'globals';
import pluginN from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['node_modules/', 'dist/'],
  },
  // Recommended configurations
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Custom configuration for JS and TS files
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      n: pluginN,
    },
    rules: {
      // Node + ESM specific (using eslint-plugin-n)
      'n/no-missing-import': 'off', // Handled by TypeScript compiler's module resolution
      'n/no-extraneous-import': 'error',
      'n/no-unsupported-features/es-syntax': 'off',

      // Code quality
      'no-unused-vars': 'off', // Turn off in favor of TypeScript-specific rule
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-duplicate-imports': 'error',

      // Style
      eqeqeq: ['error', 'always'],
      curly: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  }
);
