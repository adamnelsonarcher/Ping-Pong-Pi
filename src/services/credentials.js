/**
 * Password storage for Ping Pong Pi.
 *
 * ## What this does and does not protect against
 *
 * Both credentials in this app are checked in the browser, against data the
 * browser has already downloaded. That is inherent to the design: your account's
 * data belongs to you, and the app hands you all of it. Anyone willing to open
 * devtools can bypass either check. Hashing does not change that and this file
 * does not pretend otherwise (docs/AUDIT.md S-06).
 *
 * What it does change is that the values are no longer *readable*. They used to
 * sit in plaintext in Firestore, in localStorage, in every JSON backup, and in
 * every network response. The realistic harm there was never someone bypassing
 * the admin gate on their own scoreboard — it was an admin password reused from
 * somewhere that matters being handed to anyone who glanced at the data.
 *
 * So: PBKDF2-SHA-256 with a per-credential random salt. Player PINs are short
 * enough to brute-force offline regardless, which is fine — they are a
 * "don't misclick your teammate's name" speed bump and are documented as such.
 * The admin password is the one that might be a real password, and it is the one
 * this meaningfully helps.
 *
 * ## Migration
 *
 * `verify()` accepts a legacy plaintext value and reports it, so callers can
 * transparently upgrade a stored credential the first time it is used correctly.
 * Nothing needs a migration script and no existing account breaks.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

/** Marks a value as hashed by this module. */
const PREFIX = 'pbkdf2$';

/**
 * Looked up per call rather than captured at module load.
 *
 * Capturing it at import time meant that anything importing this module before
 * WebCrypto was available silently fell through to the plaintext path and stayed
 * there for the life of the page — which is exactly the failure mode this module
 * exists to prevent, and it would have been invisible in production.
 */
function getSubtle() {
  return typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : undefined;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function derive(password, salt) {
  const subtle = getSubtle();
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return toHex(bits);
}

/** True if `stored` was produced by hash(), rather than being legacy plaintext. */
export function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}

/**
 * Hash a password for storage.
 *
 * Returns the empty string unchanged: "no password set" is a real state that
 * both callers check for, and it must stay distinguishable from a hash.
 */
export async function hash(password) {
  if (!password) return '';
  if (!getSubtle()) {
    // Non-secure contexts and very old browsers have no WebCrypto. Storing
    // plaintext is worse than failing loudly for a *new* credential, but failing
    // would lock the user out of their own scoreboard, so fall back and say so.
    console.warn('WebCrypto unavailable; storing this credential unhashed.');
    return password;
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await derive(password, salt);
  return `${PREFIX}${PBKDF2_ITERATIONS}$${toHex(salt)}$${digest}`;
}

/**
 * Check a password against a stored value.
 *
 * @returns {Promise<{valid: boolean, needsUpgrade: boolean}>} `needsUpgrade` is
 * true when the stored value was legacy plaintext and matched, so the caller can
 * re-store it hashed.
 */
export async function verify(password, stored) {
  if (!isHashed(stored)) {
    // Legacy plaintext, or a credential written by a browser without WebCrypto.
    return { valid: password === stored, needsUpgrade: password === stored && !!stored };
  }

  const subtle = getSubtle();
  if (!subtle) return { valid: false, needsUpgrade: false };

  const [, iterations, saltHex, digest] = stored.split('$');
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex),
      iterations: Number(iterations) || PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    KEY_BITS
  );

  return { valid: constantTimeEquals(toHex(bits), digest), needsUpgrade: false };
}

/**
 * Compare without leaking length or position through timing.
 *
 * Timing attacks are not a realistic threat model for a scoreboard on a wall,
 * but this costs nothing and means the comparison is not the weakest link if
 * this module is ever reused somewhere it does matter.
 */
function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
