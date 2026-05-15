import pluginNode from 'eslint-plugin-node';
import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      node: pluginNode,
    },
    rules: {
      // Node + ESM specific
      'node/no-missing-import': 'error',
      'node/no-extraneous-import': 'error',
      'node/no-unsupported-features/es-syntax': 'off',

      // Code quality
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-undef': 'error',
      'no-duplicate-imports': 'error',

      // Style
      eqeqeq: ['error', 'always'],
      curly: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'dist/'],
  },
];
