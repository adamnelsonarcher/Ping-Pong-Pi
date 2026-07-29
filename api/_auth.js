const admin = require('./firebase-admin');
const { userKey } = require('./userKey');

/**
 * Verify the caller's Firebase ID token.
 *
 * Returns the decoded token, or null after sending a 401 — callers should
 * `if (!user) return;`.
 *
 * Before this existed, the API took the account name from the request body and
 * did no checking at all, so anyone could read or overwrite any account by
 * naming it (docs/AUDIT.md S-03). Nothing may derive identity from client input:
 * only from the value this function returns.
 */
async function requireUser(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) {
      res.status(403).json({ error: 'Account has no email address' });
      return null;
    }
    return decoded;
  } catch {
    // Expired tokens are routine — the client refreshes and retries.
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

module.exports = { requireUser, userKey };
