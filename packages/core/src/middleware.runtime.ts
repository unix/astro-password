import type { APIContext, MiddlewareHandler, MiddlewareNext } from 'astro'

import {
  ASTRO_ASSET_PATH,
  CACHE_CONTROL_NO_STORE,
  DEFAULT_AUTH_PATH,
  DEFAULT_COOKIE_NAME,
  DEFAULT_LOGOUT_PATH,
  DEFAULT_MAX_AGE,
  DEFAULT_REDIRECT_PARAM,
  DEFAULT_SALT,
  HTTPS_PROTOCOL,
  JSON_CONTENT_TYPE,
  METHOD_POST,
  PASSWORD_FIELD_NAME,
  ROOT_PATH,
  STATUS_FOUND,
  STATUS_OK,
  STATUS_UNAUTHORIZED,
} from './shared/constants'
import { readCookie, serializeCookie } from './shared/cookies'
import { digestValue, passwordCookieHash, timingSafeEqual } from './shared/crypto'
import { isStaticRoutePattern, matchesPath, normalizePath } from './shared/paths'
import {
  normalizeCookieMaxAgeOption,
  normalizeCookieNameOption,
  normalizePasswordOption,
  normalizeRedirectPathOption,
  normalizeRoutePathOption,
  normalizeRoutePathOptions,
} from './shared/options'
import type {
  AstroPasswordOptions,
  PasswordLoginResult,
  PasswordPath,
} from './shared/types'

type PasswordMiddlewareOptions = Omit<AstroPasswordOptions, 'auth' | 'password'> & {
  authPath?: string
  logoutPath?: string
  logoutRedirectPath?: string
  password?: string
}

type PasswordMiddlewareInput = PasswordMiddlewareOptions | PasswordPath
const ALL_ROUTES_PATH = '/[...path]'
const CACHE_CONTROL_HEADER = 'cache-control'
const COOKIE_VARY_VALUE = 'Cookie'
const VARY_HEADER = 'vary'
const VARY_WILDCARD = '*'

type ResolvedPasswordOptions = Required<
  Omit<PasswordMiddlewareOptions, 'logoutRedirectPath'>
> & {
  logoutRedirectPath?: string
  redirectParam: string
}

const resolveOptions = (
  options: PasswordMiddlewareOptions,
): ResolvedPasswordOptions => ({
  authPath: normalizeRoutePathOption(
    options.authPath ?? DEFAULT_AUTH_PATH,
    'authPath',
  ),
  cookieName: normalizeCookieNameOption(
    options.cookieName ?? DEFAULT_COOKIE_NAME,
    'cookieName',
  ),
  logoutPath: normalizeRoutePathOption(
    options.logoutPath ?? DEFAULT_LOGOUT_PATH,
    'logoutPath',
  ),
  logoutRedirectPath:
    options.logoutRedirectPath === undefined
      ? undefined
      : normalizeRedirectPathOption(
          options.logoutRedirectPath,
          'logoutRedirectPath',
        ),
  maxAge: normalizeCookieMaxAgeOption(options.maxAge ?? DEFAULT_MAX_AGE, 'maxAge'),
  password: normalizePasswordOption(options.password, 'password'),
  redirectParam: DEFAULT_REDIRECT_PARAM,
  salt: options.salt ?? DEFAULT_SALT,
})

const appendCookieVary = (response: Response) => {
  const vary = response.headers.get(VARY_HEADER)

  if (!vary) {
    response.headers.set(VARY_HEADER, COOKIE_VARY_VALUE)
    return response
  }

  const values = vary
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  const alreadyVariesByCookie = values.some(
    value =>
      value === VARY_WILDCARD ||
      value.toLowerCase() === COOKIE_VARY_VALUE.toLowerCase(),
  )

  if (alreadyVariesByCookie) return response
  response.headers.set(VARY_HEADER, [...values, COOKIE_VARY_VALUE].join(', '))
  return response
}

const applyNoStore = (response: Response) => {
  response.headers.set(CACHE_CONTROL_HEADER, CACHE_CONTROL_NO_STORE)
  return appendCookieVary(response)
}

const jsonResponse = (body: PasswordLoginResult, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      [CACHE_CONTROL_HEADER]: CACHE_CONTROL_NO_STORE,
      'content-type': JSON_CONTENT_TYPE,
      [VARY_HEADER]: COOKIE_VARY_VALUE,
    },
  })

const passwordCookie = (
  context: APIContext,
  passwordHash: string,
  options: ResolvedPasswordOptions,
) =>
  serializeCookie(options.cookieName, passwordHash, {
    httpOnly: true,
    maxAge: options.maxAge,
    path: ROOT_PATH,
    sameSite: 'strict',
    secure: context.url.protocol === HTTPS_PROTOCOL,
  })

const isPasswordPath = (value: PasswordMiddlewareInput): value is PasswordPath =>
  typeof value === 'string' || Array.isArray(value)

const appendPasswordCookie = (
  response: Response,
  context: APIContext,
  passwordHash: string,
  options: ResolvedPasswordOptions,
) => {
  response.headers.append(
    'set-cookie',
    passwordCookie(context, passwordHash, options),
  )
}

const isPasswordSubmission = (request: Request) => request.method === METHOD_POST

const readSubmittedPassword = async (request: Request) => {
  try {
    const body: unknown = await request.json()
    if (!(typeof body === 'object' && body && PASSWORD_FIELD_NAME in body)) return
    const password = body[PASSWORD_FIELD_NAME]
    if (typeof password === 'string') return password
  } catch {
    return
  }
}

const clearedPasswordCookie = (
  context: APIContext,
  options: ResolvedPasswordOptions,
) =>
  passwordCookie(context, '', {
    ...options,
    maxAge: 0,
  })

const authorizeRequest = async (
  context: APIContext,
  password: string,
  passwordHash: string,
  options: ResolvedPasswordOptions,
) => {
  const requestPassword = await readSubmittedPassword(context.request)
  const requestHash = await digestValue(requestPassword ?? '')
  const expectedHash = await digestValue(password)

  if (!timingSafeEqual(requestHash, expectedHash))
    return jsonResponse({ ok: false }, STATUS_UNAUTHORIZED)

  const response = jsonResponse({ ok: true }, STATUS_OK)
  appendPasswordCookie(response, context, passwordHash, options)
  return response
}

const logout = (
  context: APIContext,
  paths: string[],
  options: ResolvedPasswordOptions,
) => {
  const redirectPath =
    options.logoutRedirectPath ??
    paths.find(path => isStaticRoutePattern(path)) ??
    ROOT_PATH
  return new Response(null, {
    status: STATUS_FOUND,
    headers: {
      [CACHE_CONTROL_HEADER]: CACHE_CONTROL_NO_STORE,
      location: new URL(redirectPath, context.url).toString(),
      'set-cookie': clearedPasswordCookie(context, options),
      [VARY_HEADER]: COOKIE_VARY_VALUE,
    },
  })
}

const rewriteToAuth = async (
  context: APIContext,
  next: MiddlewareNext,
  options: ResolvedPasswordOptions,
) => {
  const authUrl = new URL(options.authPath, context.url)
  authUrl.searchParams.set(
    options.redirectParam,
    `${context.url.pathname}${context.url.search}`,
  )

  return applyNoStore(await next(authUrl))
}

const isAuthRoute = (pathname: string, options: ResolvedPasswordOptions) =>
  pathname === options.authPath

const isAstroAssetRoute = (pathname: string) =>
  matchesPath([ASTRO_ASSET_PATH], pathname)

const EMPTY_MIDDLEWARE_OPTIONS: PasswordMiddlewareOptions = {}

export const createPasswordMiddleware = (
  pathOrOptions: PasswordMiddlewareInput = ROOT_PATH,
  options: PasswordMiddlewareOptions = EMPTY_MIDDLEWARE_OPTIONS,
): MiddlewareHandler => {
  const paths = isPasswordPath(pathOrOptions)
    ? normalizeRoutePathOptions(pathOrOptions, 'path')
    : [ALL_ROUTES_PATH]
  const resolvedOptions = resolveOptions(
    isPasswordPath(pathOrOptions) ? options : pathOrOptions,
  )

  return async (context, next) => {
    const pathname = normalizePath(context.url.pathname)
    const isAuthPage = isAuthRoute(pathname, resolvedOptions)
    const isLoginRequest = isPasswordSubmission(context.request)
    if (isAstroAssetRoute(pathname)) return next()
    if (pathname === resolvedOptions.logoutPath)
      return logout(context, paths, resolvedOptions)
    if (isAuthPage && !isLoginRequest) return applyNoStore(await next())
    const isProtectedPath = matchesPath(paths, pathname)
    if (!isAuthPage && !isProtectedPath) return next()
    const passwordHash = await passwordCookieHash(
      resolvedOptions.password,
      resolvedOptions.salt,
    )
    const cookieHash = readCookie(
      context.request.headers.get('cookie'),
      resolvedOptions.cookieName,
    )

    if (timingSafeEqual(cookieHash, passwordHash)) return applyNoStore(await next())
    if (isLoginRequest)
      return authorizeRequest(
        context,
        resolvedOptions.password,
        passwordHash,
        resolvedOptions,
      )

    return rewriteToAuth(context, next, resolvedOptions)
  }
}
