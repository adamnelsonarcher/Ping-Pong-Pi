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
 */
module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { settings, players, gameHistory } = req.body || {};

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

  try {
    // Dotted-path update so we touch only this user's subtree, instead of
    // read-modify-writing the whole document.
    await db
      .collection('pingpong')
      .doc('data')
      .set(
        { users: { [userKey(user.email)]: { settings, players, gameHistory } } },
        { merge: true }
      );

    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    // Deliberately not logging req.body: it contains every player password and
    // the admin password in plaintext (docs/AUDIT.md S-08).
    console.error('Error saving data:', error.message);
    res.status(500).json({ error: 'Could not save account data' });
  }
};
