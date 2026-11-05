import { createPublicKey, createVerify } from 'node:crypto'

const jwksCache = new Map()

function decode(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

function verifySignature(jwt, jwk) {
  const [head, body, sig] = String(jwt).split('.')
  if (!head || !body || !sig) throw new Error('malformed JWT')
  const header = decode(head)
  if (header.alg !== 'RS256') throw new Error(`unsupported JWT alg: ${header.alg}`)
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${head}.${body}`)
  verifier.end()
  if (!verifier.verify(key, Buffer.from(sig, 'base64url'))) throw new Error('JWT signature rejected')
  return decode(body)
}

async function loadJwks(uri, fetchImpl) {
  const cached = jwksCache.get(uri)
  if (cached && cached.expiresAt > Date.now()) return cached.keys
  const response = await fetchImpl(uri)
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`)
  const body = await response.json()
  const keys = Array.isArray(body.keys) ? body.keys : []
  jwksCache.set(uri, { keys, expiresAt: Date.now() + 300_000 })
  return keys
}

export function reviewAuthMode(env = process.env) {
  const mode = String(env.RESEARCH_REVIEW_AUTH ?? 'off').toLowerCase()
  return mode === 'virtual' || mode === 'oidc' ? mode : 'off'
}

export async function verifyReviewerToken(token, env = process.env, fetchImpl = fetch) {
  const mode = reviewAuthMode(env)
  if (mode === 'off') return null
  if (typeof token !== 'string' || token.trim() === '') throw new Error('reviewer token is required in authenticated mode')
  if (mode === 'virtual') {
    const match = /^virtual:([\p{Letter}\p{Number}._@-]{1,128})$/u.exec(token.trim())
    if (!match) throw new Error('invalid virtual reviewer token')
    return { sub: match[1], mode: 'virtual', verified: false, note: 'local test identity only' }
  }
  const issuer = env.OIDC_ISSUER?.trim()
  const audience = env.OIDC_AUDIENCE?.trim()
  const jwksUri = env.OIDC_JWKS_URI?.trim()
  if (!issuer || !audience || !jwksUri) throw new Error('OIDC_ISSUER, OIDC_AUDIENCE and OIDC_JWKS_URI are required')
  const [head] = token.split('.')
  const header = decode(head)
  const keys = await loadJwks(jwksUri, fetchImpl)
  const jwk = keys.find((candidate) => candidate.kid === header.kid) ?? keys[0]
  if (!jwk) throw new Error('JWKS has no key')
  const payload = verifySignature(token, jwk)
  if (payload.iss !== issuer) throw new Error('OIDC issuer mismatch')
  if (payload.aud !== audience) throw new Error('OIDC audience mismatch')
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('OIDC token expired')
  if (!payload.sub) throw new Error('OIDC token has no sub')
  return { sub: payload.sub, email: payload.email ?? null, mode: 'oidc', verified: true }
}
