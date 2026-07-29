const admin = require('./firebase-admin');
const { requireUser, userKey } = require('./_auth');

const db = admin.firestore();

/**
 * Delete the authenticated caller's account data. Nobody else's.
 *
 * This replaces a client-side implementation that fetched the entire database
 * into the browser, deleted one key and posted the whole thing back. It threw,
 * so it never worked — but had anyone "fixed" it, it would have been a one-click
 * wipe of every user on the platform (docs/AUDIT.md D-05).
 */
module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    await db
      .collection('pingpong')
      .doc('data')
      .update({ [`users.${userKey(user.email)}`]: admin.firestore.FieldValue.delete() });

    res.json({ message: 'Account data deleted' });
  } catch (error) {
    // update() rejects if the document does not exist; nothing to delete is fine.
    if (error.code === 5 || /NOT_FOUND/i.test(error.message || '')) {
      return res.json({ message: 'Nothing to delete' });
    }
    console.error('Error deleting account:', error.message);
    res.status(500).json({ error: 'Could not delete account data' });
  }
};
