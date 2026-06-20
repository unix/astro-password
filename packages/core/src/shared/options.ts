import { ROOT_PATH } from './constants'
import { normalizePath } from './paths'
import type { PasswordPath } from './types'

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u
const SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/iu
const SCHEME_RELATIVE_PATH_PATTERN = /^[/\\]{2}/u

const formatOptionValue = (value: unknown) => {
  if (typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value) || String(value)
  } catch {
    return String(value)
  }
}

const hasControlCharacter = (value: string) =>
  Array.from(value).some(character => character < ' ' || character === '\u007F')

const optionError = (optionName: string, message: string, value: unknown) =>
  new Error(
    `astro-password option "${optionName}" ${message}. Received ${formatOptionValue(value)}.`,
  )

const assertPathString = (value: string, optionName: string) => {
  if (typeof value !== 'string')
    throw optionError(optionName, 'must be a string', value)
  if (!value) throw optionError(optionName, 'must not be empty', value)
  if (hasControlCharacter(value))
    throw optionError(optionName, 'must not contain control characters', value)
  if (value.includes('\\'))
    throw optionError(optionName, 'must not contain backslashes', value)
  if (SCHEME_PATTERN.test(value) || SCHEME_RELATIVE_PATH_PATTERN.test(value))
    throw optionError(
      optionName,
      'must be a site-local path, not an absolute or scheme-relative URL',
      value,
    )
}

export const normalizeRoutePathOption = (value: string, optionName: string) => {
  assertPathString(value, optionName)
  if (value.includes('?') || value.includes('#'))
    throw optionError(optionName, 'must not include a query string or hash', value)
  return normalizePath(value)
}

export const normalizeRoutePathOptions = (
  value: PasswordPath,
  optionName: string,
) => {
  const values = Array.isArray(value) ? value : [value]
  return values.map((path, index) =>
    normalizeRoutePathOption(path, `${optionName}[${index}]`),
  )
}

export const normalizeRedirectPathOption = (value: string, optionName: string) => {
  assertPathString(value, optionName)
  const redirectUrl = new URL(
    value.startsWith(ROOT_PATH) ? value : `${ROOT_PATH}${value}`,
    'https://astro-password.local/',
  )

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
}

export const normalizeCookieNameOption = (value: string, optionName: string) => {
  if (typeof value !== 'string')
    throw optionError(optionName, 'must be a string', value)
  if (!COOKIE_NAME_PATTERN.test(value))
    throw optionError(optionName, 'must be a valid cookie name', value)
  return value
}

export const normalizeCookieMaxAgeOption = (value: number, optionName: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw optionError(optionName, 'must be a finite number', value)
  if (!Number.isInteger(value))
    throw optionError(optionName, 'must be an integer', value)
  if (value < 0)
    throw optionError(optionName, 'must be greater than or equal to 0', value)
  return value
}

export const normalizePasswordOption = (value: unknown, optionName: string) => {
  if (typeof value !== 'string')
    throw optionError(optionName, 'must be a string', value)
  if (!value) throw optionError(optionName, 'must not be empty', value)
  return value
}
