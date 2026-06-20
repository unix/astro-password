# Astro Password

Password protection for Astro pages using Astro middleware.

`astro-password` adds a shared-password gate to selected Astro routes. It injects
a password page, rewrites unauthenticated requests to that page, validates
password submissions, and stores successful access in an HTTP-only cookie.

This package is intended for simple shared-password protection. It is not a full
authentication or authorization system.

## Usage

```ts
// astro.config.mjs
import astroPassword from 'astro-password'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    astroPassword({
      password: 'secret',
      paths: '/private/[...path]',
    }),
  ],
})
```

`paths` accepts Astro route patterns. Static routes match exactly, `[id]`
matches one segment, and `[...path]` matches zero or more segments.

## API

### `astroPassword(options)`

The default export and named `astroPassword` export create the Astro integration.

```ts
import astroPassword, { astroPassword as namedAstroPassword } from 'astro-password'
```

Options:

| Option       | Type                                                                                           | Description                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `paths`      | `string \| string[]`                                                                           | Astro route pattern or patterns to protect.                   |
| `password`   | `string`                                                                                       | Required shared password.                                     |
| `auth`       | `{ path: string; customLoginPage: boolean; logoutPath?: string; logoutRedirectPath?: string }` | Login and logout routes. Omit for `/protected` and `/logout`. |
| `cookieName` | `string`                                                                                       | Password cookie name. Defaults to `DEFAULT_COOKIE_NAME`.      |
| `maxAge`     | `number`                                                                                       | Cookie max age in seconds. Defaults to `3600`.                |
| `salt`       | `string`                                                                                       | Salt used for the password cookie hash.                       |

### Custom login page

Use `astro-password/components` when you want to render your own login route.

```astro
---
import { PasswordLoginForm } from 'astro-password/components'
---

<PasswordLoginForm />
```

`PasswordLoginForm` accepts optional labels and paths:

| Prop             | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `checkingLabel`  | Submit button text while validation is running.           |
| `errorMessage`   | Message shown when validation fails.                      |
| `idPrefix`       | Prefix for generated form element IDs.                    |
| `passwordLabel`  | Password input label.                                     |
| `redirectTo`     | Same-origin path to visit after successful validation.    |
| `submitLabel`    | Default submit button text.                               |
| `validationPath` | Same-origin path that receives the password POST request. |

### Exports

The main entry exports:

- `astroPassword` and the default integration export.
- `passwordCookieHash`.
- `DEFAULT_AUTH_PATH`, `DEFAULT_COOKIE_NAME`, `DEFAULT_LOGOUT_PATH`,
  and `DEFAULT_REDIRECT_PARAM`.
- TypeScript types for integration options, auth options, paths, and login
  results.

## License

MIT. See [LICENSE](LICENSE).
