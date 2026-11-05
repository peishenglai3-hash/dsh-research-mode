import assert from 'node:assert/strict'
import test from 'node:test'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { reviewAuthMode, verifyReviewerToken } from '../lib/auth.js'

test('auth off returns no identity', async () => {
  assert.equal(reviewAuthMode({}), 'off')
  assert.equal(await verifyReviewerToken('anything', {}), null)
})

test('virtual mode accepts only virtual:<sub> and is marked unverified', async () => {
  const env = { RESEARCH_REVIEW_AUTH: 'virtual' }
  const identity = await verifyReviewerToken('virtual:reviewer-123', env)
  assert.equal(identity.sub, 'reviewer-123')
  assert.equal(identity.verified, false)
  await assert.rejects(() => verifyReviewerToken('bad', env), /invalid virtual reviewer token/)
})

test('oidc mode verifies RS256 JWT against JWKS and checks iss/aud/exp', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const kid = 'test-key'
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid }
  const b64 = (value) => Buffer.from(value).toString('base64url')
  const sign = (payload) => {
    const head = b64(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }))
    const body = b64(JSON.stringify(payload))
    const signer = createSign('RSA-SHA256')
    signer.update(`${head}.${body}`)
    signer.end()
    return `${head}.${body}.${signer.sign(privateKey).toString('base64url')}`
  }
  const env = {
    RESEARCH_REVIEW_AUTH: 'oidc',
    OIDC_ISSUER: 'https://issuer.test',
    OIDC_AUDIENCE: 'research-host',
    OIDC_JWKS_URI: 'https://issuer.test/.well-known/jwks.json',
  }
  const fetchImpl = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })
  const payload = { iss: 'https://issuer.test', aud: 'research-host', sub: 'reviewer-oidc', exp: Math.floor(Date.now() / 1000) + 300 }
  const identity = await verifyReviewerToken(sign(payload), env, fetchImpl)
  assert.equal(identity.sub, 'reviewer-oidc')
  assert.equal(identity.verified, true)
  await assert.rejects(() => verifyReviewerToken(sign({ ...payload, aud: 'wrong' }), env, fetchImpl), /audience mismatch/)
})
