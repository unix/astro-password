import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'astro-password',
        replacement: resolve(root, 'packages/core/src/index.ts'),
      },
      {
        find: '@',
        replacement: resolve(root, 'packages/preview/src'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
  },
})
