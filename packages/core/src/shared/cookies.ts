import { normalizeCookieMaxAgeOption, normalizeCookieNameOption } from './options'

const COOKIE_PART_SEPARATOR = ';'
const COOKIE_VALUE_SEPARATOR = '='
const HEADER_PART_SEPARATOR = '; '

export type CookieSameSite = 'strict' | 'lax' | 'none'

export type CookieOptions = {
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: CookieSameSite
  secure?: boolean
}

const decodeCookieValue = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const formatSameSite = (sameSite: CookieSameSite) => {
  if (sameSite === 'strict') return 'Strict'
  if (sameSite === 'lax') return 'Lax'
  return 'None'
}

export const readCookie = (cookieHeader: string | null, name: string) => {
  if (!cookieHeader) return undefined
  const cookiePrefix = `${name}${COOKIE_VALUE_SEPARATOR}`
  const cookie = cookieHeader
    .split(COOKIE_PART_SEPARATOR)
    .map(part => part.trim())
    .find(part => part.startsWith(cookiePrefix))

  if (!cookie) return undefined
  return decodeCookieValue(cookie.slice(cookiePrefix.length))
}

export const serializeCookie = (
  name: string,
  value: string,
  options: CookieOptions = {},
) => {
  const cookieName = normalizeCookieNameOption(name, 'cookieName')
  const parts = [
    `${cookieName}${COOKIE_VALUE_SEPARATOR}${encodeURIComponent(value)}`,
  ]
  if (options.path) parts.push(`Path=${options.path}`)
  if (typeof options.maxAge === 'number') {
    const maxAge = normalizeCookieMaxAgeOption(options.maxAge, 'maxAge')
    parts.push(`Max-Age=${maxAge}`)
  }
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${formatSameSite(options.sameSite)}`)
  return parts.join(HEADER_PART_SEPARATOR)
}
