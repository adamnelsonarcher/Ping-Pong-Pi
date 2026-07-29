const admin = require('./firebase-admin');
const { requireUser, userKey } = require('./_auth');

const db = admin.firestore();

const EMPTY_ACCOUNT = { settings: {}, players: {}, gameHistory: [] };

/**
 * Return the authenticated caller's account.
 *
 * Note there is no userId parameter any more. The account is whoever the token
 * says it is; a client cannot ask for someone else's data (docs/AUDIT.md S-03).
 */
module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const doc = await db.collection('pingpong').doc('data').get();
    const data = doc.exists ? doc.data() : {};
    const users = data.users || {};

    res.json(users[userKey(user.email)] || EMPTY_ACCOUNT);
  } catch (error) {
    console.error('Error reading data:', error.message);
    res.status(500).json({ error: 'Could not read account data' });
  }
};
