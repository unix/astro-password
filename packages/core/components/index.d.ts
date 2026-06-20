import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

export type PasswordLoginFormProps = {
  checkingLabel?: string
  errorMessage?: string
  idPrefix?: string
  passwordLabel?: string
  redirectTo?: string
  submitLabel?: string
  validationPath?: string
}

export const PasswordLoginForm: AstroComponentFactory
