const HASH_ALGORITHM = 'SHA-256'
const HEX_BYTE_LENGTH = 2
const HEX_RADIX = 16
const EMPTY_CODE_POINT = 0

export const digestValue = async (value: string) => {
  const data = new TextEncoder().encode(value)
  const hash = await globalThis.crypto.subtle.digest(HASH_ALGORITHM, data)

  return Array.from(new Uint8Array(hash), byte =>
    byte.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, '0'),
  ).join('')
}

export const passwordCookieHash = (password: string, salt: string) =>
  digestValue(`${salt}:${password}`)

export const timingSafeEqual = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  const leftValue = left ?? ''
  const rightValue = right ?? ''
  let difference = leftValue.length ^ rightValue.length

  for (let index = 0; index < rightValue.length; index += 1) {
    const leftCode =
      index < leftValue.length ? leftValue.charCodeAt(index) : EMPTY_CODE_POINT
    const rightCode =
      index < rightValue.length ? rightValue.charCodeAt(index) : EMPTY_CODE_POINT

    difference |= leftCode ^ rightCode
  }

  return difference === 0
}
