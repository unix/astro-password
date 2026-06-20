import type { AstroIntegration } from 'astro'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { DEFAULT_AUTH_PATH } from './shared/constants'
import { isRoutePatternCoveredBy, routeComponentToPattern } from './shared/paths'
import {
  normalizeCookieMaxAgeOption,
  normalizeCookieNameOption,
  normalizePasswordOption,
  normalizeRedirectPathOption,
  normalizeRoutePathOption,
  normalizeRoutePathOptions,
} from './shared/options'
import type {
  AstroPasswordAuth,
  AstroPasswordOptions,
  PasswordPath,
} from './shared/types'

export type AstroPasswordIntegrationOptions = AstroPasswordOptions & {
  paths?: PasswordPath
}

type AstroPasswordIntegration = (
  options: AstroPasswordIntegrationOptions,
) => AstroIntegration

type PasswordMiddlewareOptions = Omit<AstroPasswordOptions, 'auth'> & {
  authPath: string
  logoutPath?: string
  logoutRedirectPath?: string
}

type ResolvedAuth = {
  customLoginPage: boolean
  logoutPath?: string
  logoutRedirectPath?: string
  path: string
}

const runtimeEntrypoint = () =>
  new URL(
    import.meta.url.endsWith('.ts')
      ? './middleware.runtime.ts'
      : './middleware.runtime.js',
    import.meta.url,
  )

const protectedEntrypoint = () =>
  pathToFileURL(
    resolve(dirname(fileURLToPath(import.meta.url)), '../protected.astro'),
  )

const resolveAuth = (auth?: AstroPasswordAuth): ResolvedAuth => {
  if (!auth)
    return {
      customLoginPage: false,
      path: DEFAULT_AUTH_PATH,
    }

  return {
    customLoginPage: auth.customLoginPage === true,
    logoutPath:
      auth.logoutPath === undefined
        ? undefined
        : normalizeRoutePathOption(auth.logoutPath, 'auth.logoutPath'),
    logoutRedirectPath:
      auth.logoutRedirectPath === undefined
        ? undefined
        : normalizeRedirectPathOption(
            auth.logoutRedirectPath,
            'auth.logoutRedirectPath',
          ),
    path: normalizeRoutePathOption(auth.path, 'auth.path'),
  }
}

const customAuthRouteError = (authPath: string) =>
  new Error(
    `astro-password auth path "${authPath}" is marked customLoginPage, but no matching route was found under src/pages. Create a matching page route or remove customLoginPage: true.`,
  )

const middlewareEntrypoint = (
  paths: string[],
  options: PasswordMiddlewareOptions,
) => `
	import { createPasswordMiddleware } from ${JSON.stringify(runtimeEntrypoint().toString())}

	const paths = ${JSON.stringify(paths)}
	const options = ${JSON.stringify(options)}

	export const onRequest = createPasswordMiddleware(paths, options)
	`

const createAstroPassword = (
  options: Partial<AstroPasswordIntegrationOptions> = {},
): AstroIntegration => {
  const { auth, cookieName, maxAge, paths, salt } = options
  const resolvedAuth = resolveAuth(auth)
  const password = normalizePasswordOption(options.password, 'password')
  const protectedPatterns = paths ? normalizeRoutePathOptions(paths, 'paths') : []
  let matchedCustomAuthRoute = false
  const matchedProtectedPatterns = new Set<string>()
  const middlewareOptions = {
    authPath: resolvedAuth.path,
    cookieName:
      cookieName === undefined
        ? undefined
        : normalizeCookieNameOption(cookieName, 'cookieName'),
    logoutPath: resolvedAuth.logoutPath,
    logoutRedirectPath: resolvedAuth.logoutRedirectPath,
    maxAge:
      maxAge === undefined
        ? undefined
        : normalizeCookieMaxAgeOption(maxAge, 'maxAge'),
    password,
    salt,
  }

  return {
    name: 'astro-password',
    hooks: {
      'astro:config:setup': ({ addMiddleware, createCodegenDir, injectRoute }) => {
        if (!resolvedAuth.customLoginPage)
          injectRoute({
            pattern: resolvedAuth.path,
            entrypoint: protectedEntrypoint(),
            prerender: false,
          })

        if (!protectedPatterns.length) return
        const codegenDir = createCodegenDir()
        const entrypoint = new URL('middleware.mjs', codegenDir)
        writeFileSync(
          entrypoint,
          middlewareEntrypoint(protectedPatterns, middlewareOptions),
        )
        addMiddleware({
          entrypoint,
          order: 'pre',
        })
      },
      'astro:route:setup': ({ route }) => {
        const componentPattern = routeComponentToPattern(route.component)
        if (!componentPattern) return

        if (resolvedAuth.customLoginPage && componentPattern === resolvedAuth.path) {
          matchedCustomAuthRoute = true
          route.prerender = false
        }

        if (!protectedPatterns.length) return
        const matchedPatterns = protectedPatterns.filter(protectedPattern =>
          isRoutePatternCoveredBy(componentPattern, protectedPattern),
        )
        if (!matchedPatterns.length) return
        route.prerender = false
        matchedPatterns.forEach(pattern => matchedProtectedPatterns.add(pattern))
      },
      'astro:routes:resolved': ({ logger }) => {
        if (resolvedAuth.customLoginPage && !matchedCustomAuthRoute)
          throw customAuthRouteError(resolvedAuth.path)

        protectedPatterns.forEach(pattern => {
          if (matchedProtectedPatterns.has(pattern)) return

          logger.warn(
            `No route matched protected path "${pattern}". The middleware will still run for matching requests, but no page was switched to on-demand rendering.`,
          )
        })
      },
    },
  }
}

export const astroPassword: AstroPasswordIntegration = createAstroPassword

export default astroPassword
