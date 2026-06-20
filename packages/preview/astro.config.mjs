import tailwindcss from '@tailwindcss/vite'
import astroPassword from '../core/src/integration.ts'
import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  integrations: [
    astroPassword({
      auth: {
        customLoginPage: true,
        path: '/protected',
      },
      password: 'astro',
      paths: '/private',
    }),
  ],

  devToolbar: {
    enabled: false,
  },
  session: {
    driver: {
      entrypoint: 'unstorage/drivers/null',
    },
  },
  adapter: cloudflare({}),
  vite: {
    plugins: [tailwindcss()],
  },
  trailingSlash: 'never',
})
