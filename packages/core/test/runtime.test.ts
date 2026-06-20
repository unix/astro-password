import type { APIContext, MiddlewareNext } from 'astro'
import { describe, expect, it, vi } from 'vitest'

import {
  CACHE_CONTROL_NO_STORE,
  DEFAULT_COOKIE_NAME,
  DEFAULT_SALT,
  JSON_CONTENT_TYPE,
} from '../src/shared/constants'
import { createPasswordMiddleware } from '../src/middleware.runtime'
import { digestValue, passwordCookieHash } from '../src/shared/crypto'

const PASSWORD = 'astro'
const COOKIE_VARY_VALUE = 'cookie'
const LEGACY_HEADER_NAME = 'X-Astro-Password'
type RuntimePasswordOptions = NonNullable<
  Parameters<typeof createPasswordMiddleware>[1]
>

const loginRequest = (password: string): RequestInit => ({
  body: JSON.stringify({ password }),
  headers: {
    'content-type': JSON_CONTENT_TYPE,
  },
  method: 'POST',
})

const context = (url: string, init?: RequestInit) =>
  ({
    request: new Request(url, init),
    url: new URL(url),
  }) as APIContext

const next = () =>
  vi.fn(async (rewriteUrl?: URL) => new Response(rewriteUrl?.toString() ?? 'ok'))

const expectResponse = (result: void | Response) => {
  expect(result).toBeInstanceOf(Response)
  if (!result) throw new Error('Expected middleware to return a response')
  return result
}

const varyValues = (response: Response) =>
  (response.headers.get('vary') ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

const expectNoStore = (response: Response) => {
  expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL_NO_STORE)
  expect(varyValues(response)).toContain(COOKIE_VARY_VALUE)
}

describe('createPasswordMiddleware', () => {
  it('rewrites protected requests to the auth page with the original target', async () => {
    const middleware = createPasswordMiddleware('/private/[...path]', {
      password: PASSWORD,
    })
    const nextMiddleware = next()

    const response = expectResponse(
      await middleware(
        context('https://example.test/private/report?tab=summary'),
        nextMiddleware as MiddlewareNext,
      ),
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
    expect(rewriteUrl?.searchParams.get('redirect')).toBe(
      '/private/report?tab=summary',
    )
    expectNoStore(response)
  })

  it('uses exact matching for static paths', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })
    const nextMiddleware = next()

    const response = expectResponse(
      await middleware(
        context('https://example.test/private'),
        nextMiddleware as MiddlewareNext,
      ),
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
    expectNoStore(response)
  })

  it('leaves child routes public when only a static path is protected', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/private/report'),
        next() as MiddlewareNext,
      ),
    )

    expect(await response.text()).toBe('ok')
  })

  it('protects every page when only options are provided', async () => {
    const middleware = createPasswordMiddleware({
      password: PASSWORD,
    })
    const nextMiddleware = next()

    const response = expectResponse(
      await middleware(
        context('https://example.test/dashboard'),
        nextMiddleware as MiddlewareNext,
      ),
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
    expect(rewriteUrl?.searchParams.get('redirect')).toBe('/dashboard')
    expectNoStore(response)
  })

  it('uses the configured auth path', async () => {
    const middleware = createPasswordMiddleware('/private', {
      authPath: '/login',
      password: PASSWORD,
    })
    const nextMiddleware = next()

    const response = expectResponse(
      await middleware(
        context('https://example.test/private'),
        nextMiddleware as MiddlewareNext,
      ),
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/login')
    expectNoStore(response)
  })

  it('throws before handling requests when runtime options are invalid', () => {
    const invalidOptions: Array<Omit<RuntimePasswordOptions, 'password'>> = [
      {
        authPath: '//evil.test/login',
      },
      {
        cookieName: 'bad;name',
      },
      {
        logoutRedirectPath: '//evil.test/signed-out',
      },
      {
        maxAge: Number.NaN,
      },
    ]

    invalidOptions.forEach(options => {
      expect(() =>
        createPasswordMiddleware('/private', {
          ...options,
          password: PASSWORD,
        }),
      ).toThrow('astro-password option')
    })

    expect(() =>
      createPasswordMiddleware('/private', {} as RuntimePasswordOptions),
    ).toThrow('password')

    expect(() =>
      createPasswordMiddleware('/private', {
        password: '',
      }),
    ).toThrow('password')
  })

  it('leaves the auth page public when everything is protected', async () => {
    const middleware = createPasswordMiddleware({
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/protected'),
        next() as MiddlewareNext,
      ),
    )

    expect(await response.text()).toBe('ok')
    expectNoStore(response)
  })

  it('accepts a valid password POST on the auth page', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/protected', loginRequest(PASSWORD)),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expectNoStore(response)
    expect(response.headers.get('set-cookie')).toContain(`${DEFAULT_COOKIE_NAME}=`)
  })

  it('rejects an invalid password POST on the auth page', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/protected', loginRequest('wrong')),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false })
    expectNoStore(response)
    expect(response.headers.has('set-cookie')).toBe(false)
  })

  it('does not accept legacy request hash headers on GET requests', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })
    const requestHash = await digestValue(PASSWORD)
    const nextMiddleware = next()

    const response = expectResponse(
      await middleware(
        context('https://example.test/private', {
          headers: {
            [LEGACY_HEADER_NAME]: requestHash,
          },
        }),
        nextMiddleware as MiddlewareNext,
      ),
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
    expect(await response.text()).toBe(
      'https://example.test/protected?redirect=%2Fprivate',
    )
    expectNoStore(response)
  })

  it('leaves Astro assets public when everything is protected', async () => {
    const middleware = createPasswordMiddleware({
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/_astro/client.js'),
        next() as MiddlewareNext,
      ),
    )

    expect(await response.text()).toBe('ok')
  })

  it('supports dynamic segment protection', async () => {
    const middleware = createPasswordMiddleware('/users/[id]', {
      password: PASSWORD,
    })
    const nextMiddleware = next()

    await middleware(
      context('https://example.test/users/ada'),
      nextMiddleware as MiddlewareNext,
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
  })

  it('does not match extra segments for dynamic paths', async () => {
    const middleware = createPasswordMiddleware('/users/[id]', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/users/ada/profile'),
        next() as MiddlewareNext,
      ),
    )

    expect(await response.text()).toBe('ok')
  })

  it('supports rest segment protection', async () => {
    const middleware = createPasswordMiddleware('/users/[...path]', {
      password: PASSWORD,
    })
    const nextMiddleware = next()

    await middleware(
      context('https://example.test/users/ada/profile'),
      nextMiddleware as MiddlewareNext,
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
  })

  it('matches a rest segment with an empty value', async () => {
    const middleware = createPasswordMiddleware('/users/[...path]', {
      password: PASSWORD,
    })
    const nextMiddleware = next()

    await middleware(
      context('https://example.test/users'),
      nextMiddleware as MiddlewareNext,
    )

    const rewriteUrl = nextMiddleware.mock.calls[0]?.[0]
    expect(rewriteUrl).toBeInstanceOf(URL)
    expect(rewriteUrl?.pathname).toBe('/protected')
  })

  it('sets the password cookie when the submitted password is accepted', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/private', loginRequest(PASSWORD)),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expectNoStore(response)
    expect(response.headers.get('set-cookie')).toContain(`${DEFAULT_COOKIE_NAME}=`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=3600')
    expect(response.headers.get('set-cookie')).toContain('Secure')
  })

  it('omits the secure cookie attribute for HTTP requests', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('http://example.test/private', loginRequest(PASSWORD)),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).not.toContain('Secure')
  })

  it('rejects an invalid submitted password without issuing a cookie', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/private', loginRequest('wrong')),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false })
    expectNoStore(response)
    expect(response.headers.has('set-cookie')).toBe(false)
  })

  it('adds private cache headers to protected responses authorized by cookie', async () => {
    const passwordHash = await passwordCookieHash(PASSWORD, DEFAULT_SALT)
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })
    const nextMiddleware = vi.fn(
      async () =>
        new Response('ok', {
          headers: {
            'cache-control': 'public, max-age=31536000',
            vary: 'Accept-Encoding',
          },
        }),
    )

    const response = expectResponse(
      await middleware(
        context('https://example.test/private', {
          headers: {
            cookie: `${DEFAULT_COOKIE_NAME}=${passwordHash}`,
          },
        }),
        nextMiddleware as MiddlewareNext,
      ),
    )

    expect(await response.text()).toBe('ok')
    expectNoStore(response)
    expect(varyValues(response)).toEqual(['accept-encoding', COOKIE_VARY_VALUE])
  })

  it('clears the password cookie while redirecting on logout', async () => {
    const middleware = createPasswordMiddleware('/private', {
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/logout'),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(302)
    expectNoStore(response)
    expect(response.headers.get('location')).toBe('https://example.test/private')
    expect(response.headers.get('set-cookie')).toContain(`${DEFAULT_COOKIE_NAME}=`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('uses the configured logout redirect path when provided', async () => {
    const middleware = createPasswordMiddleware('/private', {
      logoutRedirectPath: '/signed-out',
      password: PASSWORD,
    })

    const response = expectResponse(
      await middleware(
        context('https://example.test/logout'),
        next() as MiddlewareNext,
      ),
    )

    expect(response.status).toBe(302)
    expectNoStore(response)
    expect(response.headers.get('location')).toBe('https://example.test/signed-out')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
