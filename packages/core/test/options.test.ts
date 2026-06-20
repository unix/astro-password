import { describe, expect, it } from 'vitest'

import {
  normalizeCookieMaxAgeOption,
  normalizeCookieNameOption,
  normalizePasswordOption,
  normalizeRedirectPathOption,
  normalizeRoutePathOption,
} from '../src/shared/options'

const AUTH_PATH_OPTION = 'auth.path'
const LOGOUT_REDIRECT_OPTION = 'auth.logoutRedirectPath'
const MAX_AGE = 60 * 60

describe('option normalization', () => {
  it('normalizes route paths while rejecting external URL forms', () => {
    expect(normalizeRoutePathOption('login/', AUTH_PATH_OPTION)).toBe('/login')
    ;[
      '//evil.test/login',
      'https://evil.test/login',
      'javascript:alert(1)',
      '\\\\evil.test\\login',
      '/login?next=/private',
      '/login#form',
    ].forEach(value => {
      expect(() => normalizeRoutePathOption(value, AUTH_PATH_OPTION)).toThrow(
        AUTH_PATH_OPTION,
      )
    })
  })

  it('normalizes redirect paths while rejecting external URL forms', () => {
    expect(
      normalizeRedirectPathOption(
        'signed-out?from=logout#done',
        LOGOUT_REDIRECT_OPTION,
      ),
    ).toBe('/signed-out?from=logout#done')
    ;[
      '//evil.test/signed-out',
      'https://evil.test/signed-out',
      'javascript:alert(1)',
      '\\\\evil.test\\signed-out',
    ].forEach(value => {
      expect(() =>
        normalizeRedirectPathOption(value, LOGOUT_REDIRECT_OPTION),
      ).toThrow(LOGOUT_REDIRECT_OPTION)
    })
  })

  it('validates cookie names', () => {
    expect(normalizeCookieNameOption('ASTRO_PASSWORD', 'cookieName')).toBe(
      'ASTRO_PASSWORD',
    )
    ;['', 'bad name', 'bad;name', 'bad=name'].forEach(value => {
      expect(() => normalizeCookieNameOption(value, 'cookieName')).toThrow(
        'cookieName',
      )
    })
  })

  it('validates cookie max age values', () => {
    expect(normalizeCookieMaxAgeOption(MAX_AGE, 'maxAge')).toBe(MAX_AGE)
    ;[Number.NaN, Number.POSITIVE_INFINITY, -1, Number('1.5')].forEach(value => {
      expect(() => normalizeCookieMaxAgeOption(value, 'maxAge')).toThrow('maxAge')
    })
  })

  it('validates password values', () => {
    expect(normalizePasswordOption('astro', 'password')).toBe('astro')
    ;['', undefined, 1].forEach(value => {
      expect(() => normalizePasswordOption(value, 'password')).toThrow('password')
    })
  })
})
