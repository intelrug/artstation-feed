module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.eslint.json',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'modules-newline',
    'import',
  ],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:unicorn/recommended',
    'airbnb-typescript/base',
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    'max-len': ['error', {
      code: 120,
      tabWidth: 2,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    }],
    'class-methods-use-this': 'off',
    'no-await-in-loop': 'off',
    'no-console': 'off',
    'no-continue': 'off',
    'no-plusplus': 'off',
    'import/prefer-default-export': 'off',
    'import/extensions': 'off',
    'import/no-cycle': 'off',

    '@typescript-eslint/no-inferrable-types': 'off',

    'modules-newline/import-declaration-newline': 'error',
    'modules-newline/export-declaration-newline': 'error',

    'import/order': ['error', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      pathGroups: [
        {
          pattern: '~/**',
          group: 'internal',
        },
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-array-reduce': 'off',
    'unicorn/no-for-loop': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prefer-ternary': 'off',
    'unicorn/prevent-abbreviations': [
      'error',
      {
        ignore: [
          'e2e',
          /args/i,
          '^(i|j)$',
        ],
      },
    ],
  },
  overrides: [{
    files: ['src/database/migrations/**/*.{js,ts}'],
    rules: {
      'class-methods-use-this': 'off',
      'unicorn/filename-case': 'off',
    },
  }],
};
