/**
 * Firestore map keys cannot contain a '.', so emails are escaped.
 *
 * This is deliberately a standalone module with no dependencies: it is the one
 * definition of how an account maps to a storage key, and tests need to be able
 * to import it without pulling in firebase-admin (which requires credentials).
 *
 * The encoding used to be duplicated across getData, saveData and two client
 * call sites, with three different implementations between them. Writes landed
 * under `btoa(email)` while reads looked under `email.replace('.','_DOT_')`, so
 * every cloud-mode game was written to an orphan document and lost on the next
 * reload (docs/AUDIT.md D-01).
 */
function userKey(email) {
  return String(email).replace(/\./g, '_DOT_');
}

module.exports = { userKey };
