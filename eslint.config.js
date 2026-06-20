import config from '@unix/eslint'

export default [
  {
    ignores: ['**/*.astro'],
  },
  ...config,
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1, 2, 16, 60, 200, 302, 401],
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
        },
      ],
    },
  },
]
