import { ROOT_PATH } from './constants'
import type { PasswordPath } from './types'

const TRAILING_SLASH_PATTERN = /\/+$/u
const PAGE_EXTENSION_PATTERN = /\.(?:astro|mdx?|html|[jt]s)$/u
const DYNAMIC_SEGMENT_PATTERN = /^\[(?!\.\.\.)[^\]/]+\]$/u
const REST_SEGMENT_PATTERN = /^\[\.\.\.[^\]/]+\]$/u
const INDEX_SEGMENT = 'index'
const PAGES_DIRECTORY = 'pages/'
const PAGES_PATH_SEGMENT = '/pages/'

type RouteSegment =
  | {
      type: 'dynamic'
    }
  | {
      type: 'rest'
    }
  | {
      type: 'static'
      value: string
    }

export const normalizePath = (path: string) => {
  if (path === ROOT_PATH) return ROOT_PATH
  const prefixedPath = path.startsWith(ROOT_PATH) ? path : `${ROOT_PATH}${path}`
  const normalizedPath = prefixedPath.replace(TRAILING_SLASH_PATTERN, '')
  if (normalizedPath) return normalizedPath
  return ROOT_PATH
}

export const normalizePaths = (path: PasswordPath) => {
  const paths = Array.isArray(path) ? path : [path]
  return paths.map(normalizePath)
}

const routeSegments = (pattern: string) => {
  const normalizedPattern = normalizePath(pattern)
  if (normalizedPattern === ROOT_PATH) return []

  return normalizedPattern
    .split(ROOT_PATH)
    .filter(Boolean)
    .map<RouteSegment>(segment => {
      if (REST_SEGMENT_PATTERN.test(segment)) return { type: 'rest' }
      if (DYNAMIC_SEGMENT_PATTERN.test(segment)) return { type: 'dynamic' }
      return {
        type: 'static',
        value: segment,
      }
    })
}

const pathSegments = (pathname: string) => {
  const normalizedPathname = normalizePath(pathname)
  if (normalizedPathname === ROOT_PATH) return []
  return normalizedPathname.split(ROOT_PATH).filter(Boolean)
}

const segmentCanMatch = (segment: RouteSegment, value: string) => {
  if (segment.type === 'static') return segment.value === value
  return Boolean(value)
}

const matchesSegments = (
  patternSegments: RouteSegment[],
  pathnameSegments: string[],
): boolean => {
  if (!patternSegments.length) return pathnameSegments.length === 0
  const [segment, ...remainingPatternSegments] = patternSegments
  if (segment.type === 'rest') {
    if (!remainingPatternSegments.length) return true
    for (let index = 0; index <= pathnameSegments.length; index += 1) {
      if (matchesSegments(remainingPatternSegments, pathnameSegments.slice(index)))
        return true
    }

    return false
  }

  const [pathnameSegment, ...remainingPathnameSegments] = pathnameSegments
  if (!pathnameSegment) return false
  if (!segmentCanMatch(segment, pathnameSegment)) return false
  return matchesSegments(remainingPatternSegments, remainingPathnameSegments)
}

export const matchesPath = (paths: string[], pathname: string) => {
  const segments = pathSegments(pathname)
  return paths.some(path => matchesSegments(routeSegments(path), segments))
}

const segmentIsCoveredBy = (
  routeSegment: RouteSegment,
  protectedSegment: RouteSegment,
) => {
  if (protectedSegment.type === 'dynamic') return routeSegment.type !== 'rest'
  if (protectedSegment.type === 'rest') return true
  return (
    routeSegment.type === 'static' && routeSegment.value === protectedSegment.value
  )
}

const canMatchEmptySegments = (segments: RouteSegment[]) =>
  matchesSegments(segments, [])

const routeSegmentsAreCoveredBy = (
  routePatternSegments: RouteSegment[],
  protectedPatternSegments: RouteSegment[],
): boolean => {
  if (!routePatternSegments.length)
    return canMatchEmptySegments(protectedPatternSegments)
  if (!protectedPatternSegments.length) return false
  const [routeSegment, ...remainingRouteSegments] = routePatternSegments
  const [protectedSegment, ...remainingProtectedSegments] = protectedPatternSegments
  if (protectedSegment.type === 'rest') {
    if (!remainingProtectedSegments.length) return true
    for (let index = 0; index <= routePatternSegments.length; index += 1) {
      if (
        routeSegmentsAreCoveredBy(
          routePatternSegments.slice(index),
          remainingProtectedSegments,
        )
      )
        return true
    }

    return false
  }
  if (routeSegment.type === 'rest') return false
  if (!segmentIsCoveredBy(routeSegment, protectedSegment)) return false
  return routeSegmentsAreCoveredBy(
    remainingRouteSegments,
    remainingProtectedSegments,
  )
}

export const isRoutePatternCoveredBy = (
  routePattern: string,
  protectedPattern: string,
) =>
  routeSegmentsAreCoveredBy(
    routeSegments(routePattern),
    routeSegments(protectedPattern),
  )

export const isStaticRoutePattern = (pattern: string) =>
  routeSegments(pattern).every(segment => segment.type === 'static')

export const routeComponentToPattern = (component: string) => {
  const normalizedComponent = component.replaceAll('\\', ROOT_PATH)
  const pagesIndex = normalizedComponent.lastIndexOf(PAGES_PATH_SEGMENT)
  const routeFileStart =
    pagesIndex === -1
      ? normalizedComponent.startsWith(PAGES_DIRECTORY)
        ? PAGES_DIRECTORY.length
        : -1
      : pagesIndex + PAGES_PATH_SEGMENT.length
  if (routeFileStart === -1) return

  const routeFile = normalizedComponent
    .slice(routeFileStart)
    .replace(PAGE_EXTENSION_PATTERN, '')
  const routePattern = normalizePath(routeFile)
  if (routePattern === `/${INDEX_SEGMENT}`) return ROOT_PATH
  if (routePattern.endsWith(`/${INDEX_SEGMENT}`))
    return routePattern.slice(0, -`/${INDEX_SEGMENT}`.length)
  return routePattern
}
