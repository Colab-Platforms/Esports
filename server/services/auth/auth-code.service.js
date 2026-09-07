const crypto = require('crypto');
const AuthCode = require('../../models/AuthCode');

const CODE_TTL_MS = 60 * 1000; // single-use, so this only bounds how long an unclaimed code stays valid

/**
 * Mints a one-time code for the OAuth callback redirect. The frontend
 * immediately exchanges it via exchangeCode() for the actual JWT - the code
 * itself grants nothing on its own beyond that one exchange.
 */
async function issueCode({ userId, provider, isNewUser }) {
  const code = crypto.randomBytes(32).toString('hex');
  await AuthCode.create({
    code,
    userId,
    provider,
    isNewUser: Boolean(isNewUser),
    expiresAt: new Date(Date.now() + CODE_TTL_MS)
  });
  return code;
}

/**
 * Atomically claims a code - the findOneAndUpdate filter on `used:false`
 * makes this single-use even under concurrent/duplicate exchange requests.
 * Returns the claimed record, or null if the code is unknown, expired, or
 * already used.
 */
async function exchangeCode(code) {
  if (!code || typeof code !== 'string') return null;

  return AuthCode.findOneAndUpdate(
    { code, used: false, expiresAt: { $gt: new Date() } },
    { $set: { used: true } },
    { new: true }
  );
}

module.exports = { issueCode, exchangeCode };
