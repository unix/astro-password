import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { astroPassword } from '../src'
import type { AstroPasswordIntegrationOptions } from '../src'

const PASSWORD = 'astro'
const tempDirs: string[] = []

const setupIntegration = (
  integration = astroPassword({
    password: PASSWORD,
  }),
) => {
  const addMiddleware = vi.fn()
  const tempDir = mkdtempSync(join(tmpdir(), 'astro-password-'))
  const codegenDir = pathToFileURL(`${tempDir}/`)
  const createCodegenDir = vi.fn(() => codegenDir)
  const injectRoute = vi.fn()
  const setup = integration.hooks['astro:config:setup']

  tempDirs.push(tempDir)
  setup?.({ addMiddleware, createCodegenDir, injectRoute } as never)

  return {
    addMiddleware,
    codegenDir,
    createCodegenDir,
    injectRoute,
  }
}

const setupRoute = (
  integration: ReturnType<typeof astroPassword>,
  component: string,
) => {
  const route: {
    component: string
    prerender?: boolean
  } = {
    component,
  }

  integration.hooks['astro:route:setup']?.({ route } as never)

  return route
}

describe('astroPassword', () => {
  afterEach(() => {
    tempDirs.splice(0).forEach(tempDir => {
      rmSync(tempDir, {
        force: true,
        recursive: true,
      })
    })
  })

  it('injects the default auth page route', () => {
    const { addMiddleware, injectRoute } = setupIntegration()
    const route = injectRoute.mock.calls[0]?.[0]

    expect(injectRoute).toHaveBeenCalledWith({
      pattern: '/protected',
      entrypoint: expect.any(URL),
      prerender: false,
    })
    expect(route.entrypoint.protocol).toBe('file:')
    expect(fileURLToPath(route.entrypoint)).toMatch(/protected\.astro$/)
    expect(addMiddleware).not.toHaveBeenCalled()
  })

  it('normalizes a configured auth route object', () => {
    const { injectRoute } = setupIntegration(
      astroPassword({
        auth: {
          customLoginPage: false,
          path: 'login',
        },
        password: PASSWORD,
      }),
    )

    expect(injectRoute).toHaveBeenCalledWith({
      pattern: '/login',
      entrypoint: expect.any(URL),
      prerender: false,
    })
  })

  it('throws when integration options are invalid', () => {
    expect(() =>
      astroPassword({
        auth: {
          customLoginPage: false,
          path: '//evil.test/login',
        },
        password: PASSWORD,
      }),
    ).toThrow('auth.path')

    expect(() =>
      astroPassword({
        cookieName: 'bad;name',
        password: PASSWORD,
      }),
    ).toThrow('cookieName')

    expect(() =>
      astroPassword({
        paths: '/private',
      } as AstroPasswordIntegrationOptions),
    ).toThrow('password')

    expect(() =>
      astroPassword({
        password: '',
        paths: '/private',
      }),
    ).toThrow('password')
  })

  it('adds generated middleware when protected paths are configured', () => {
    const { addMiddleware } = setupIntegration(
      astroPassword({
        auth: {
          customLoginPage: false,
          logoutPath: '/sign-out',
          logoutRedirectPath: '/signed-out',
          path: '/login',
        },
        password: 'astro',
        paths: '/private',
      }),
    )

    const middleware = addMiddleware.mock.calls[0]?.[0]
    expect(middleware).toMatchObject({
      entrypoint: expect.any(URL),
      order: 'pre',
    })

    const content = readFileSync(middleware.entrypoint, 'utf8')
    expect(content).toContain('createPasswordMiddleware(paths, options)')
    expect(content).not.toContain('definePasswordMiddleware')
    expect(content).toContain('"/private"')
    expect(content).toContain('"authPath":"/login"')
    expect(content).toContain('"logoutPath":"/sign-out"')
    expect(content).toContain('"logoutRedirectPath":"/signed-out"')
    expect(content).toContain('"password":"astro"')
  })

  it('does not forward removed login form options to generated middleware', () => {
    const options = {
      headerName: 'X-Custom-Password',
      password: PASSWORD,
      paths: '/private',
      redirectParam: 'next',
    } as AstroPasswordIntegrationOptions
    const { addMiddleware } = setupIntegration(astroPassword(options))

    const middleware = addMiddleware.mock.calls[0]?.[0]
    const content = readFileSync(middleware.entrypoint, 'utf8')
    expect(content).not.toContain('X-Custom-Password')
    expect(content).not.toContain('"headerName"')
    expect(content).not.toContain('"redirectParam"')
    expect(content).not.toContain('"next"')
  })

  it('does not forward legacy top-level logout options to generated middleware', () => {
    const options = {
      logoutPath: '/legacy-logout',
      logoutRedirectPath: '/legacy-signed-out',
      password: PASSWORD,
      paths: '/private',
    } as unknown as AstroPasswordIntegrationOptions
    const { addMiddleware } = setupIntegration(astroPassword(options))

    const middleware = addMiddleware.mock.calls[0]?.[0]
    const content = readFileSync(middleware.entrypoint, 'utf8')
    expect(content).not.toContain('/legacy-logout')
    expect(content).not.toContain('/legacy-signed-out')
  })

  it('does not forward the removed secure option to generated middleware', () => {
    const options = {
      password: PASSWORD,
      paths: '/private',
      secure: false,
    } as unknown as AstroPasswordIntegrationOptions
    const { addMiddleware } = setupIntegration(astroPassword(options))

    const middleware = addMiddleware.mock.calls[0]?.[0]
    const content = readFileSync(middleware.entrypoint, 'utf8')
    expect(content).not.toContain('"secure"')
  })

  it('uses an existing custom auth route without injecting the built-in page', () => {
    const logger = {
      warn: vi.fn(),
    }
    const integration = astroPassword({
      auth: {
        customLoginPage: true,
        path: '/password-entry',
      },
      password: PASSWORD,
      paths: '/private',
    })
    const { injectRoute } = setupIntegration(integration)

    const authRoute = setupRoute(integration, 'src/pages/password-entry.astro')
    setupRoute(integration, 'src/pages/private.astro')

    expect(injectRoute).not.toHaveBeenCalled()
    expect(authRoute.prerender).toBe(false)
    expect(() =>
      integration.hooks['astro:routes:resolved']?.({ logger } as never),
    ).not.toThrow()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('throws when a custom auth route is missing', () => {
    const logger = {
      warn: vi.fn(),
    }
    const integration = astroPassword({
      auth: {
        customLoginPage: true,
        path: '/password-entry',
      },
      password: PASSWORD,
    })

    setupIntegration(integration)

    expect(() =>
      integration.hooks['astro:routes:resolved']?.({ logger } as never),
    ).toThrow(
      'astro-password auth path "/password-entry" is marked customLoginPage, but no matching route was found under src/pages.',
    )
  })

  it('marks exact static protected routes as on-demand', () => {
    const integration = astroPassword({ password: PASSWORD, paths: '/private' })

    const privateRoute = setupRoute(integration, 'src/pages/private.astro')
    const childRoute = setupRoute(integration, 'src/pages/private/settings.astro')

    expect(privateRoute.prerender).toBe(false)
    expect(childRoute.prerender).toBeUndefined()
  })

  it('marks dynamic route patterns regardless of parameter names', () => {
    const integration = astroPassword({
      password: PASSWORD,
      paths: '/private/[id]',
    })

    const dynamicRoute = setupRoute(integration, 'src/pages/private/[slug].astro')
    const staticChildRoute = setupRoute(
      integration,
      'src/pages/private/settings.astro',
    )
    const restRoute = setupRoute(integration, 'src/pages/private/[...path].astro')

    expect(dynamicRoute.prerender).toBe(false)
    expect(staticChildRoute.prerender).toBe(false)
    expect(restRoute.prerender).toBeUndefined()
  })

  it('marks routes covered by rest patterns as on-demand', () => {
    const integration = astroPassword({
      password: PASSWORD,
      paths: '/private/[...path]',
    })

    const indexRoute = setupRoute(integration, 'src/pages/private/index.astro')
    const staticChildRoute = setupRoute(
      integration,
      'src/pages/private/settings.astro',
    )
    const dynamicRoute = setupRoute(integration, 'src/pages/private/[slug].astro')
    const restRoute = setupRoute(integration, 'src/pages/private/[...slug].astro')

    expect(indexRoute.prerender).toBe(false)
    expect(staticChildRoute.prerender).toBe(false)
    expect(dynamicRoute.prerender).toBe(false)
    expect(restRoute.prerender).toBe(false)
  })

  it('warns when no page route matches a protected path', () => {
    const logger = {
      warn: vi.fn(),
    }
    const integration = astroPassword({ password: PASSWORD, paths: '/missing' })

    integration.hooks['astro:routes:resolved']?.({ logger } as never)

    expect(logger.warn).toHaveBeenCalledWith(
      'No route matched protected path "/missing". The middleware will still run for matching requests, but no page was switched to on-demand rendering.',
    )
  })
})
