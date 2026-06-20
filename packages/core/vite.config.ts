import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        'middleware.runtime': resolve(
          import.meta.dirname,
          'src/middleware.runtime.ts',
        ),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^node:/, 'astro'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
