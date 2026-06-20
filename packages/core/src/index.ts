export {
  DEFAULT_AUTH_PATH,
  DEFAULT_COOKIE_NAME,
  DEFAULT_LOGOUT_PATH,
  DEFAULT_REDIRECT_PARAM,
} from './shared/constants'
export { passwordCookieHash } from './shared/crypto'
export { astroPassword, default } from './integration'
export type { AstroPasswordIntegrationOptions } from './integration'
export type {
  AstroPasswordAuth,
  AstroPasswordOptions,
  PasswordLoginResult,
  PasswordPath,
} from './shared/types'
