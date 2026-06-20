import astroPassword from 'astro-password'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    astroPassword({
      auth: {
        customLoginPage: true,
        path: '/my-login',
      },
      password: 'astro',
      paths: '/private',
    }),
  ],
})
