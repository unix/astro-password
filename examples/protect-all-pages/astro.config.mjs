import astroPassword from 'astro-password'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    astroPassword({
      password: 'astro',
      paths: '/[...path]',
    }),
  ],
})
