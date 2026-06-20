# Astro Password

Password protection for Astro pages using Astro middleware.

## Security scope

astro-password is a lightweight shared-password gate for simple Astro pages. It
is not a complete authentication system and does not provide user accounts,
authorization roles, audit logs, rate limiting, multi-factor authentication, or
password reset flows.

Use it only over HTTPS. Avoid logging request bodies, cookies, and auth-related
headers in application logs, reverse proxies, analytics, or error reporting
tools.

## Usage

Add the integration, set a password, and list the Astro route patterns to
protect:

```ts
// astro.config.mjs
import astroPassword from 'astro-password'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    astroPassword({
      password: 'secret',
      paths: '/private',
    }),
  ],
})
```

Unauthenticated visitors see the auth page through a rewrite, so the original URL
stays in the address bar until the password cookie is issued.

See the [default usage example](examples/default-usage) for a minimal Astro
project.

## Features

### Protect every route

Use a rest route pattern to require the password for the whole site:

```ts
export default defineConfig({
  integrations: [
    astroPassword({
      password: 'secret',
      paths: '/[...path]',
    }),
  ],
})
```

The auth page stays public so visitors can sign in.
See the [protect all pages example](examples/protect-all-pages) for a complete
project.

### Protect nested routes

`paths` uses Astro route pattern syntax. Static routes are exact, `[id]`
matches one segment, and `[...path]` matches zero or more segments:

```ts
export default defineConfig({
  integrations: [
    astroPassword({
      password: 'secret',
      paths: '/private/[...path]',
    }),
  ],
})
```

This protects `/private`, `/private/settings`, and deeper pages.
The integration injects the password middleware and switches matching page routes
to on-demand rendering, so a project does not need its own `src/middleware.ts`
for the common case.
If a project already has middleware, astro-password participates in the same
chain and runs before project middleware.

See the [examples directory](examples) for runnable projects using these route
patterns.

### Customize the login page

Set `customLoginPage: true`, point `auth.path` at your login route, and create
the matching page under `src/pages`:

```ts
// astro.config.mjs
export default defineConfig({
  integrations: [
    astroPassword({
      auth: {
        customLoginPage: true,
        path: '/password-entry',
      },
      password: 'secret',
      paths: '/private',
    }),
  ],
})
```

```astro
---
// src/pages/password-entry.astro
import { PasswordLoginForm } from 'astro-password/components'
---

<PasswordLoginForm />
```

When `customLoginPage: true` is set, astro-password does not inject the built-in
auth route, so the matching page must exist.

See the [custom login page example](examples/custom-login-page) for a complete
project.

## APIs

See the [core package documentation](packages/core/README.md) for API details.

## License

MIT. See [LICENSE](LICENSE).
