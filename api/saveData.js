const admin = require('./firebase-admin');
const { requireUser, userKey } = require('./_auth');

const db = admin.firestore();

/** Refuse absurd payloads rather than letting one account fill the document. */
const MAX_PLAYERS = 500;
const MAX_HISTORY = 1000;

/**
 * Overwrite the authenticated caller's account.
 *
 * The account key comes from the verified token, never from the body — the body
 * used to carry `currentUser`, which meant anyone could overwrite anyone
 * (docs/AUDIT.md S-03) and which is also how the write key drifted out of sync
 * with the read key (docs/AUDIT.md D-01).
 *
 * Writes are optimistically concurrent. Each account carries a `revision`; a
 * client sends the revision it loaded, and a write whose base no longer matches
 * is rejected with 409 plus the current document so the client can merge and
 * retry. Without this, two devices signed into the same account silently
 * overwrote each other (docs/AUDIT.md D-03).
 *
 * The read-compare-write runs inside a Firestore transaction. Doing the check
 * outside one would only narrow the race window rather than close it.
 */
module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { settings, players, gameHistory, baseRevision } = req.body || {};

  if (typeof settings !== 'object' || settings === null) {
    return res.status(400).json({ error: 'settings must be an object' });
  }
  if (typeof players !== 'object' || players === null) {
    return res.status(400).json({ error: 'players must be an object' });
  }
  if (!Array.isArray(gameHistory)) {
    return res.status(400).json({ error: 'gameHistory must be an array' });
  }
  if (Object.keys(players).length > MAX_PLAYERS) {
    return res.status(413).json({ error: `Too many players (max ${MAX_PLAYERS})` });
  }
  if (gameHistory.length > MAX_HISTORY) {
    return res.status(413).json({ error: `Too much history (max ${MAX_HISTORY})` });
  }

  const key = userKey(user.email);
  const docRef = db.collection('pingpong').doc('data');

  try {
    const revision = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      const current = doc.exists ? (doc.data().users || {})[key] : undefined;
      const currentRevision = Number.isFinite(current?.revision) ? current.revision : 0;

      // A client that sends no baseRevision is opting out of the check — used by
      // the unload flush, where losing the race matters less than losing the write.
      if (Number.isFinite(baseRevision) && baseRevision !== currentRevision) {
        const conflict = new Error('Revision conflict');
        conflict.code = 'REVISION_CONFLICT';
        conflict.current = current || { settings: {}, players: {}, gameHistory: [], revision: currentRevision };
        throw conflict;
      }

      const next = currentRevision + 1;
      tx.set(
        docRef,
        {
          users: {
            [key]: {
              settings,
              players,
              gameHistory,
              revision: next,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        { merge: true }
      );
      return next;
    });

    res.json({ message: 'Data saved successfully', revision });
  } catch (error) {
    if (error.code === 'REVISION_CONFLICT') {
      return res.status(409).json({
        error: 'This account was changed on another device',
        current: error.current,
      });
    }
    // Deliberately not logging req.body: it contains every player password and
    // the admin password (docs/AUDIT.md S-08).
    console.error('Error saving data:', error.message);
    res.status(500).json({ error: 'Could not save account data' });
  }
};
