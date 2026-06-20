export type PasswordPath = string | string[]

export type AstroPasswordAuth = {
  customLoginPage: boolean
  logoutPath?: string
  logoutRedirectPath?: string
  path: string
}

export type AstroPasswordOptions = {
  auth?: AstroPasswordAuth
  cookieName?: string
  maxAge?: number
  password: string
  salt?: string
}

export type PasswordLoginResult = {
  ok: boolean
}
